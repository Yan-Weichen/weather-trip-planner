/**
 * services/gemini.ts — Google Gemini AI 行程生成服務
 *
 * 使用 @google/genai SDK 呼叫 Gemini 1.5 Flash 模型。
 * 所有 AI 呼叫均使用 JSON Schema 結構化輸出（responseMimeType: 'application/json'），
 * 確保回傳格式可直接解析為 TripPlan 型別，不需要額外處理。
 *
 * 模型策略：優先使用 gemini-2.0-flash，失敗時自動 fallback 到 gemini-2.5-flash。
 *
 * 提供以下四個 AI 功能：
 * 1. generateItineraryWithAI：完整行程生成（主流程）
 * 2. getReplacementCandidates：單一景點替換候選（3 個備選）
 * 3. regenerateTransitForDay：重新生成整日交通節點
 * 4. regenerateDayWithAI：整日行程重新生成（保留鎖定項目）
 */
import { GoogleGenAI, Type, type Schema } from '@google/genai';
import type { DayWeather, TripPlan, ItineraryItem } from '../types';
import type { Preference } from './generateItinerary';
import { geocodeCity } from './weather';

/** Gemini AI 客戶端實例 */
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

/**
 * 單一行程項目的 JSON Schema。
 * 供多個 AI 功能共用（主行程、替換候選、整日重生成）。
 * lat/lon 列為 required，確保 AI 一定提供座標。
 */
const itineraryItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: ['attraction', 'meal', 'lodging', 'transit'], description: '項目類型' },
    name: { type: Type.STRING, description: '名稱' },
    address: { type: Type.STRING, description: '完整地址（可被地圖搜尋到）' },
    lat: { type: Type.NUMBER, description: '緯度' },
    lon: { type: Type.NUMBER, description: '經度' },
    durationMinutes: { type: Type.INTEGER, description: '停留或移動分鐘數' },
    description: { type: Type.STRING, description: '推薦理由或說明，需提到天氣' },
    costMin: { type: Type.INTEGER, description: '預估最低花費（台幣）' },
    costMax: { type: Type.INTEGER, description: '預估最高花費（台幣）' },
    category: { type: Type.STRING, enum: ['indoor', 'outdoor'], description: '室內或戶外（僅 attraction）' },
    mealType: { type: Type.STRING, enum: ['breakfast', 'lunch', 'dinner'], description: '餐別（僅 meal）' },
    transitMode: { type: Type.STRING, description: '交通方式（僅 transit）' },
  },
  required: ['type', 'name', 'address', 'lat', 'lon', 'durationMinutes', 'description', 'costMin', 'costMax'],
};

/** 整趟旅行計畫的 JSON Schema（generateItineraryWithAI 使用） */
const tripPlanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    destination: { type: Type.STRING, description: '目的地名稱' },
    startDate: { type: Type.STRING, description: '出發日期 YYYY-MM-DD' },
    endDate: { type: Type.STRING, description: '回程日期 YYYY-MM-DD' },
    dailyPlans: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dayNumber: { type: Type.INTEGER, description: '第幾天' },
          date: { type: Type.STRING, description: '日期 YYYY-MM-DD' },
          lodgingArea: { type: Type.STRING, description: '當天住宿區域' },
          items: { type: Type.ARRAY, items: itineraryItemSchema },
        },
        required: ['dayNumber', 'date', 'items'],
      },
    },
  },
  required: ['destination', 'startDate', 'endDate', 'dailyPlans'],
};

/**
 * 建構 Gemini 的主要行程生成 prompt。
 * 將天氣資料、偏好、規劃規則注入為文字，讓 AI 產生符合條件的行程。
 * 重要規則包含：降雨機率 > 60% 優先室內景點、每個項目需有經緯度等。
 */
function buildPrompt(
  destination: string,
  days: number,
  preferences: Preference[],
  weatherData: DayWeather[],
): string {
  const weatherInfo = weatherData
    .slice(0, days)
    .map(
      (w) =>
        `- ${w.date}：${w.description}（${w.emoji}），最高溫 ${w.maxTemp}°C，最低溫 ${w.minTemp}°C，降雨機率 ${w.precipProbability}%`,
    )
    .join('\n');

  const prefText = preferences.length > 0 ? preferences.join('、') : '一般觀光';

  return `你是一位專業的旅遊行程規劃師。請根據以下資訊，為使用者規劃 ${destination} 的 ${days} 天旅遊行程。

旅遊偏好：${prefText}

每日天氣預報：
${weatherInfo}

請為每一天產生一條完整時間軸，依序包含以下項目：
1. 早餐（type: "meal", mealType: "breakfast"）
2. 上午 1-2 個景點（type: "attraction"）
3. 景點之間的移動（type: "transit", 註明 transitMode 交通方式）
4. 午餐（type: "meal", mealType: "lunch"）
5. 下午 1-2 個景點（type: "attraction"）
6. 景點之間的移動（type: "transit"）
7. 晚餐（type: "meal", mealType: "dinner"）
8. 視情況安排夜間景點
9. 住宿（type: "lodging", 含 lodgingArea 住宿區域）

規劃規則：
1. 降雨機率超過 60% 的日子，景點優先安排 category: "indoor"
2. 晴天或降雨機率低的日子，景點優先安排 category: "outdoor"
3. 每個項目都要有完整可被地圖搜尋到的 address（包含城市名）
4. 每個項目（包含住宿 lodging）都必須有準確的 lat 和 lon 經緯度座標
5. 同一天的景點之間距離不要太遠，方便移動
6. 每個項目的 description 用繁體中文寫推薦理由，景點需提到天氣
7. costMin / costMax 用台幣估算合理區間
8. 不需要填 startTime / endTime（前端會自己算）
9. 餐飲推薦當地特色店家，要是真實存在的
10. 所有文字使用繁體中文
11. 每天約 7-10 個 items（含交通）`;
}

/** 產生前端用的短 ID（不需全域唯一，僅用於 React key 和拖曳識別） */
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── 景點替換候選 ──

const replacementSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    candidates: {
      type: Type.ARRAY,
      items: itineraryItemSchema,
    },
  },
  required: ['candidates'],
};

/**
 * 取得景點替換候選清單（3 個備選）。
 * 使用者點選「替換」圖示時觸發，AI 根據目的地、天氣、原項目類型推薦。
 * 備選需有差異性（不同風格/價位），降雨時優先推薦室內。
 */
export async function getReplacementCandidates(
  item: ItineraryItem,
  destination: string,
  weather: { description: string; precipProbability: number },
): Promise<ItineraryItem[]> {
  const typeLabels: Record<string, string> = {
    attraction: '景點', meal: '餐飲', lodging: '住宿',
  };
  const typeLabel = typeLabels[item.type] || item.type;
  const mealHint = item.mealType
    ? `（${item.mealType === 'breakfast' ? '早餐' : item.mealType === 'lunch' ? '午餐' : '晚餐'}）`
    : '';

  const prompt = `你是專業旅遊規劃師。使用者想替換 ${destination} 行程中的一個${typeLabel}${mealHint}。

目前項目：「${item.name}」${item.address ? `（${item.address}）` : ''}
當天天氣：${weather.description}，降雨機率 ${weather.precipProbability}%

請推薦 3 個不同的替代${typeLabel}，要求：
1. 必須是 ${destination} 真實存在的地點/店家
2. 類型（type）必須和原項目相同：「${item.type}」
${item.mealType ? `3. mealType 必須是「${item.mealType}」` : ''}
${item.type === 'attraction' && weather.precipProbability > 60 ? '3. 降雨機率高，優先推薦室內景點' : ''}
4. 提供完整可被地圖搜尋的 address（含城市名）
5. 提供準確的經緯度
6. costMin / costMax 用台幣估算
7. description 用繁體中文寫推薦理由
8. 不要填 startTime / endTime
9. 3 個候選要有差異性（不同風格/價位）`;

  const models = ['gemini-2.0-flash', 'gemini-2.5-flash'];
  let text: string | undefined;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: replacementSchema,
        },
      });
      text = response.text;
      if (text) break;
    } catch (e) {
      console.warn(`Model ${model} failed for replacement`, e);
      if (model === models[models.length - 1]) throw e;
    }
  }

  if (!text) throw new Error('Gemini 未回傳替代方案');
  const raw = JSON.parse(text);
  return (raw.candidates as Array<Record<string, unknown>>).map((a) => ({
    id: uid(),
    type: (a.type as ItineraryItem['type']) ?? item.type,
    name: (a.name as string) ?? '',
    address: (a.address as string) ?? '',
    lat: (a.lat as number) || 0,
    lon: (a.lon as number) || 0,
    durationMinutes: (a.durationMinutes as number) ?? item.durationMinutes,
    description: (a.description as string) ?? '',
    costMin: (a.costMin as number) ?? 0,
    costMax: (a.costMax as number) ?? 0,
    category: a.category as ItineraryItem['category'],
    mealType: a.mealType as ItineraryItem['mealType'] ?? item.mealType,
    transitMode: undefined,
  }));
}

// ── 整日交通重新生成 ──

const transitPlanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: itineraryItemSchema,
    },
  },
  required: ['items'],
};

/**
 * 重新生成一天的交通節點。
 * 確認整日修改後呼叫：移除舊的 transit 項目，由 AI 根據景點順序
 * 重新插入合理的交通方式（捷運/步行/計程車等）和移動時間。
 * 非交通項目保留原始物件（含 id、座標、鎖定狀態）。
 */
export async function regenerateTransitForDay(
  nonTransitItems: ItineraryItem[],
  destination: string,
  _weather: { description: string; precipProbability: number },
): Promise<ItineraryItem[]> {
  const itemsList = nonTransitItems.map((it, i) => {
    const typeLabels: Record<string, string> = {
      attraction: '景點', meal: '餐飲', lodging: '住宿',
    };
    return `${i + 1}. [${typeLabels[it.type] || it.type}] ${it.name}（${it.address || '無地址'}）`;
  }).join('\n');

  const prompt = `你是專業旅遊交通規劃師。以下是 ${destination} 一天行程中已確定的景點/餐飲/住宿，按照順序排列：

${itemsList}

請在每兩個相鄰項目之間插入適當的交通方式（type: "transit"），要求：
1. 回傳完整列表（包含原有項目 + 插入的交通項目），保持原順序
2. 交通項目的 transitMode 請從以下選擇最合適的：公車、捷運、步行、計程車、火車、高鐵、租車、渡輪、纜車
3. 根據兩地距離和交通便利性推薦最適合的交通方式
4. durationMinutes 要合理估算實際移動時間
5. costMin / costMax 用台幣估算（步行為 0）
6. 交通項目的 name 格式：「前往 [下一個地點名稱]」
7. 交通項目的 address 填空字串
8. 非交通項目請保持原樣不變（name, address, type, category, mealType, durationMinutes, costMin, costMax, description 都不要改）
9. 不要填 startTime / endTime（前端會自己算）
10. 所有文字使用繁體中文`;

  const models = ['gemini-2.0-flash', 'gemini-2.5-flash'];
  let text: string | undefined;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: transitPlanSchema,
        },
      });
      text = response.text;
      if (text) break;
    } catch (e) {
      console.warn(`Model ${model} failed for transit regen`, e);
      if (model === models[models.length - 1]) throw e;
    }
  }

  if (!text) throw new Error('Gemini 未回傳交通規劃');
  const raw = JSON.parse(text);
  const rawItems = (raw.items as Array<Record<string, unknown>>) ?? [];

  // Merge: keep original non-transit items (preserve id, coords, locked), only use AI for transit
  const result: ItineraryItem[] = [];
  let origIdx = 0;

  for (const a of rawItems) {
    if (a.type === 'transit') {
      result.push({
        id: uid(),
        type: 'transit',
        name: (a.name as string) ?? '',
        address: '',
        durationMinutes: (a.durationMinutes as number) ?? 10,
        description: (a.description as string) ?? '',
        costMin: (a.costMin as number) ?? 0,
        costMax: (a.costMax as number) ?? 0,
        transitMode: (a.transitMode as string) ?? '移動',
      });
    } else {
      // Use original item to preserve id, coords, locked state
      if (origIdx < nonTransitItems.length) {
        result.push(nonTransitItems[origIdx]);
        origIdx++;
      }
    }
  }

  // If AI missed some items, append them
  while (origIdx < nonTransitItems.length) {
    result.push(nonTransitItems[origIdx]);
    origIdx++;
  }

  return result;
}

// ── 整日重新生成（保留鎖定項目）──

const dayRegenSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: { type: Type.ARRAY, items: itineraryItemSchema },
    lodgingArea: { type: Type.STRING, description: '住宿區域' },
  },
  required: ['items'],
};

/**
 * 整日行程重新生成。
 * 使用者點選「重新生成」時觸發，AI 生成全新一天行程，
 * 但必須保留所有鎖定的項目。回傳後前端會覆寫當天行程。
 *
 * 安全機制：若 AI 回傳中漏掉了鎖定項目，強制補加在末尾。
 */
export async function regenerateDayWithAI(
  lockedItems: ItineraryItem[],
  destination: string,
  weather: DayWeather,
  preferences: string[],
): Promise<{ items: ItineraryItem[]; lodgingArea?: string }> {
  const prefText = preferences.length > 0 ? preferences.join('、') : '一般觀光';

  const lockedDesc = lockedItems.length > 0
    ? lockedItems.map((it, i) => {
        const typeLabels: Record<string, string> = { attraction: '景點', meal: '餐飲', lodging: '住宿' };
        return `${i + 1}. [${typeLabels[it.type] || it.type}] ${it.name}（${it.address || '無地址'}）- 停留 ${it.durationMinutes} 分鐘`;
      }).join('\n')
    : '（無鎖定項目）';

  const prompt = `你是專業旅遊規劃師。請為 ${destination} 重新規劃一天的行程。

旅遊偏好：${prefText}
當天天氣：${weather.description}（${weather.emoji}），最高溫 ${weather.maxTemp}°C，最低溫 ${weather.minTemp}°C，降雨機率 ${weather.precipProbability}%

以下是使用者鎖定的項目，必須保留在行程中（保持原名稱和地址不變）：
${lockedDesc}

請產生一天完整的行程時間軸，要求：
1. 鎖定的項目必須全部保留，名稱和地址不可更改
2. 在鎖定項目的基礎上，補齊缺少的部分（早餐/午餐/晚餐/景點/住宿/交通）
3. 如果鎖定項目已經包含某餐，就不要重複安排同類型的餐
4. 景點之間插入適當的交通（type: "transit"，包含 transitMode）
5. transitMode 從以下選擇：公車、捷運、步行、計程車、火車、高鐵、租車、渡輪、纜車
6. 降雨機率 > 60% 優先安排室內景點
7. 每個項目要有完整 address（含城市名），經緯度要準確
8. costMin / costMax 用台幣估算
9. 不要填 startTime / endTime（前端會算）
10. 所有文字繁體中文
11. 整天約 7-10 個 items（含交通）
12. 景點推薦真實存在的地方，和鎖定項目不同`;

  const models = ['gemini-2.0-flash', 'gemini-2.5-flash'];
  let text: string | undefined;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: dayRegenSchema,
        },
      });
      text = response.text;
      if (text) break;
    } catch (e) {
      console.warn(`Model ${model} failed for day regen`, e);
      if (model === models[models.length - 1]) throw e;
    }
  }

  if (!text) throw new Error('Gemini 未回傳行程');
  const raw = JSON.parse(text);
  const rawItems = (raw.items as Array<Record<string, unknown>>) ?? [];

  // Build result: for non-transit items that match a locked item, use the original locked item (preserve id/coords/locked)
  const usedLockedIds = new Set<string>();
  const items: ItineraryItem[] = rawItems.map((a) => {
    const aiName = (a.name as string) ?? '';
    const aiType = (a.type as string) ?? '';

    // Try to match against locked items by name
    if (aiType !== 'transit') {
      const matchedLocked = lockedItems.find(
        (li) => !usedLockedIds.has(li.id) && li.name === aiName,
      );
      if (matchedLocked) {
        usedLockedIds.add(matchedLocked.id);
        return matchedLocked;
      }
    }

    return {
      id: uid(),
      type: (a.type as ItineraryItem['type']) ?? 'attraction',
      name: aiName,
      address: (a.address as string) ?? '',
      lat: (a.lat as number) || 0,
      lon: (a.lon as number) || 0,
      durationMinutes: (a.durationMinutes as number) ?? 60,
      description: (a.description as string) ?? '',
      costMin: (a.costMin as number) ?? 0,
      costMax: (a.costMax as number) ?? 0,
      category: a.category as ItineraryItem['category'],
      mealType: a.mealType as ItineraryItem['mealType'],
      transitMode: a.transitMode as string | undefined,
    };
  });

  // Safety: ensure all locked items appear (if AI missed any, append them)
  for (const li of lockedItems) {
    if (!usedLockedIds.has(li.id)) {
      items.push(li);
    }
  }

  return { items, lodgingArea: raw.lodgingArea as string | undefined };
}

/**
 * 主要行程生成函式，由 useTripPlanner.plan() 呼叫。
 * 使用 JSON Schema 強制 Gemini 輸出結構化 JSON，
 * 再解析為 TripPlan 型別。
 *
 * 若 AI 沒有提供景點座標，會額外呼叫 geocodeCity 補救。
 * 模型 fallback 順序：gemini-2.0-flash → gemini-2.5-flash。
 */
export async function generateItineraryWithAI(
  destination: string,
  days: number,
  preferences: Preference[],
  weatherData: DayWeather[],
  startDate: string,
  endDate: string,
): Promise<TripPlan> {
  const prompt = buildPrompt(destination, days, preferences, weatherData);
  const models = ['gemini-2.0-flash', 'gemini-2.5-flash'];

  try {
    let text: string | undefined;

    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: tripPlanSchema,
          },
        });
        text = response.text;
        if (text) break;
      } catch (e) {
        console.warn(`Model ${model} failed, trying next...`, e);
        if (model === models[models.length - 1]) throw e;
      }
    }

    if (!text) throw new Error('Gemini 未回傳內容');

    const raw = JSON.parse(text);

    const dailyPlans = await Promise.all(
      (raw.dailyPlans as Array<Record<string, unknown>>).map(
        async (dp: Record<string, unknown>, i: number) => {
          const weather = weatherData[i];
          const rawItems = (dp.items as Array<Record<string, unknown>>) ?? [];

          const items: ItineraryItem[] = await Promise.all(
            rawItems.map(async (a) => {
              let lat = (a.lat as number) || 0;
              let lon = (a.lon as number) || 0;
              const itemType = (a.type as string) ?? 'attraction';

              // For attractions/lodging: fallback geocode by address if AI gave no coords
              // Skip meals & transit — meals will be handled by neighbor interpolation later
              if ((!lat || !lon) && itemType !== 'transit' && itemType !== 'meal') {
                try {
                  const searchName = (a.address as string) || (a.name as string);
                  const geo = await geocodeCity(searchName);
                  lat = geo.latitude;
                  lon = geo.longitude;
                } catch {
                  // keep 0
                }
              }

              return {
                id: uid(),
                type: itemType as ItineraryItem['type'],
                name: (a.name as string) ?? '',
                address: (a.address as string) ?? '',
                lat,
                lon,
                durationMinutes: (a.durationMinutes as number) ?? 60,
                description: (a.description as string) ?? '',
                costMin: (a.costMin as number) ?? 0,
                costMax: (a.costMax as number) ?? 0,
                category: a.category as ItineraryItem['category'],
                mealType: a.mealType as ItineraryItem['mealType'],
                transitMode: a.transitMode as string | undefined,
              };
            }),
          );

          const dayBudgetMin = items.reduce((s, it) => s + it.costMin, 0);
          const dayBudgetMax = items.reduce((s, it) => s + it.costMax, 0);

          return {
            dayNumber: (dp.dayNumber as number) ?? i + 1,
            date: (dp.date as string) ?? weather.date,
            weather,
            items,
            dayBudgetMin,
            dayBudgetMax,
            lodgingArea: dp.lodgingArea as string | undefined,
          };
        },
      ),
    );

    const totalBudgetMin = dailyPlans.reduce((s, d) => s + d.dayBudgetMin, 0);
    const totalBudgetMax = dailyPlans.reduce((s, d) => s + d.dayBudgetMax, 0);

    return {
      destination: raw.destination ?? destination,
      startDate,
      endDate,
      dailyPlans,
      totalBudgetMin,
      totalBudgetMax,
    };
  } catch (err) {
    console.error('Gemini API error:', err);
    throw new Error(
      `AI 行程生成失敗：${err instanceof Error ? err.message : '未知錯誤'}，請稍後再試`,
    );
  }
}
