/**
 * hooks/useTripPlanner.ts — 核心行程規劃狀態管理 Hook
 *
 * 這是整個應用程式最重要的 Hook，負責管理行程的完整生命週期：
 *
 * 主要流程（plan 函式）：
 *   1. 城市地理編碼（Open-Meteo Geocoding）
 *   2. 取得天氣預報（Open-Meteo Forecast）
 *   3. AI 生成行程（Gemini）或 fallback 靜態生成器
 *   4. 座標校正（Nominatim geocode）
 *   5. 計算時間軸（computeTimeline）
 *   6. 非同步補充 Google Places 資訊（不阻塞 UI）
 *
 * 行程編輯功能：
 *   - reorderItems：拖曳排序（@dnd-kit 觸發）
 *   - deleteItem：刪除單一項目
 *   - toggleLock：鎖定/解鎖項目（重新生成時保留）
 *   - replaceItem：替換單一景點（並觸發 Places 補充）
 *   - confirmDayEdit：確認整日編輯，重新生成交通節點
 *   - regenerateDay：整日重新生成（保留鎖定項目）
 *   - loadTripPlan：載入已儲存的行程
 *
 * refreshPlaces 的 id 匹配機制：
 *   enrichItemsWithPlaces 是 in-place 修改物件，但 updateDay 會透過
 *   spread 建立新物件，導致參考不同。因此 refreshPlaces 完成後，
 *   使用 Map<itemId, placeDetails> 對 React state 中的物件精確注入。
 */
import { useState, useCallback } from 'react';
import { geocodeCity, getForecast } from '../services/weather';
import { generateItinerary, type Preference } from '../services/generateItinerary';
import { generateItineraryWithAI, getReplacementCandidates, regenerateTransitForDay, regenerateDayWithAI } from '../services/gemini';
import { computeTimeline } from '../utils/schedule';
import { enrichItemsWithCoords } from '../services/geocode';
import { enrichItemsWithPlaces } from '../services/places';
import type { DayWeather, TripPlan, DayPlan, ItineraryItem } from '../types';

/** 是否已設定 Gemini API 金鑰 */
const hasGeminiKey = !!import.meta.env.VITE_GEMINI_API_KEY &&
  import.meta.env.VITE_GEMINI_API_KEY !== '你的金鑰放這裡';

interface TripInput {
  destination: string;
  startDate: string;
  endDate: string;
  preferences: Preference[];
}

interface TripPlannerState {
  loading: boolean;
  error: string;
  weatherData: DayWeather[];
  tripPlan: TripPlan | null;
  cityName: string;
}

/**
 * 重新計算單日的時間軸與預算小計。
 * 每次修改行程後呼叫，確保時間與費用顯示同步。
 */
function recalcDay(day: DayPlan): DayPlan {
  const items = computeTimeline(day.items, '08:00');
  const dayBudgetMin = items.reduce((s, it) => s + it.costMin, 0);
  const dayBudgetMax = items.reduce((s, it) => s + it.costMax, 0);
  return { ...day, items, dayBudgetMin, dayBudgetMax };
}

/**
 * 重新計算整個行程的每日小計與總預算。
 * 在 plan() 和每次 updateDay 後呼叫。
 */
function recalcPlan(plan: TripPlan): TripPlan {
  const dailyPlans = plan.dailyPlans.map(recalcDay);
  return {
    ...plan,
    dailyPlans,
    totalBudgetMin: dailyPlans.reduce((s, d) => s + d.dayBudgetMin, 0),
    totalBudgetMax: dailyPlans.reduce((s, d) => s + d.dayBudgetMax, 0),
  };
}

export function useTripPlanner() {
  const [state, setState] = useState<TripPlannerState>({
    loading: false,
    error: '',
    weatherData: [],
    tripPlan: null,
    cityName: '',
  });

  /**
   * 主要行程規劃流程。
   * 依序呼叫：地理編碼 → 天氣 → AI 生成 → 座標校正 → 時間計算 → Places 補充。
   */
  const plan = async (input: TripInput) => {
    setState({ loading: true, error: '', weatherData: [], tripPlan: null, cityName: '' });

    try {
      // 步驟 1：城市名稱轉經緯度（先查 Open-Meteo，失敗再查中文對照表）
      const geo = await geocodeCity(input.destination);
      const cityName = `${geo.name}, ${geo.country}`;

      // 步驟 2：取得旅遊期間的逐日天氣預報
      const weatherData = await getForecast(
        geo.latitude, geo.longitude, input.startDate, input.endDate,
      );

      const days = weatherData.length;
      let tripPlan: TripPlan;

      // 步驟 3：有 Gemini 金鑰則用 AI 生成，否則用靜態 fallback
      if (hasGeminiKey) {
        tripPlan = await generateItineraryWithAI(
          cityName, days, input.preferences, weatherData, input.startDate, input.endDate,
        );
      } else {
        tripPlan = await generateItinerary(
          cityName, days, input.preferences, weatherData,
          input.startDate, input.endDate, geo.latitude, geo.longitude,
        );
      }

      // 步驟 4：用 Nominatim 校正 AI 給的經緯度（AI 座標有時不夠精確）
      tripPlan = {
        ...tripPlan,
        dailyPlans: await Promise.all(
          tripPlan.dailyPlans.map(async (day) => ({
            ...day,
            items: await enrichItemsWithCoords(day.items, geo.name),
          })),
        ),
      };

      // 步驟 5：計算每個項目的開始/結束時間與預算小計
      tripPlan = recalcPlan(tripPlan);

      // 步驟 6：非阻塞地補充 Places 資訊（照片、評分等），不影響行程顯示速度
      refreshPlaces(tripPlan.dailyPlans.flatMap((d) => d.items), geo.name);

      setState({ loading: false, error: '', weatherData, tripPlan, cityName });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : '發生未知錯誤',
      }));
    }
  };

  /**
   * 通用的單日更新工具函式。
   * 接受一個 updater 函式，對指定天數執行修改後重新計算時間軸與預算。
   * 所有行程編輯操作（排序、刪除、替換等）都透過此函式更新 state。
   */
  const updateDay = useCallback((dayIndex: number, updater: (day: DayPlan) => DayPlan) => {
    setState((prev) => {
      if (!prev.tripPlan) return prev;
      const dailyPlans = prev.tripPlan.dailyPlans.map((day, i) =>
        i === dayIndex ? recalcDay(updater(day)) : day,
      );
      const totalBudgetMin = dailyPlans.reduce((s, d) => s + d.dayBudgetMin, 0);
      const totalBudgetMax = dailyPlans.reduce((s, d) => s + d.dayBudgetMax, 0);
      return {
        ...prev,
        tripPlan: { ...prev.tripPlan, dailyPlans, totalBudgetMin, totalBudgetMax },
      };
    });
  }, []);

  /** 拖曳排序：將指定天的 fromIndex 位置的項目移到 toIndex */
  const reorderItems = useCallback((dayIndex: number, fromIndex: number, toIndex: number) => {
    updateDay(dayIndex, (day) => {
      const items = [...day.items];
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      return { ...day, items };
    });
  }, [updateDay]);

  /** 刪除指定天的指定索引項目 */
  const deleteItem = useCallback((dayIndex: number, itemIndex: number) => {
    updateDay(dayIndex, (day) => ({
      ...day,
      items: day.items.filter((_, i) => i !== itemIndex),
    }));
  }, [updateDay]);

  /** 切換項目的鎖定狀態（鎖定後整日重新生成會保留此項目） */
  const toggleLock = useCallback((dayIndex: number, itemIndex: number) => {
    updateDay(dayIndex, (day) => ({
      ...day,
      items: day.items.map((item, i) =>
        i === itemIndex ? { ...item, locked: !item.locked } : item,
      ),
    }));
  }, [updateDay]);

  /**
   * 非阻塞式 Places 資訊補充。
   * enrichItemsWithPlaces 完成後，用 item id 精確匹配 React state 中的物件，
   * 注入 placeDetails（不依賴物件參考，因為 updateDay 會建立新物件）。
   */
  const refreshPlaces = useCallback((items: ItineraryItem[], city: string) => {
    enrichItemsWithPlaces(items, city).then(() => {
      // 建立 id → placeDetails 的 Map，用於精確匹配更新
      const detailsMap = new Map(
        items.filter((it) => it.placeDetails).map((it) => [it.id, it.placeDetails!])
      );
      setState((prev) => {
        if (!prev.tripPlan) return prev;
        const dailyPlans = prev.tripPlan.dailyPlans.map((day) => ({
          ...day,
          items: day.items.map((item) => {
            const pd = detailsMap.get(item.id);
            return pd ? { ...item, placeDetails: pd } : item;
          }),
        }));
        return { ...prev, tripPlan: { ...prev.tripPlan, dailyPlans } };
      });
    }).catch(() => {});
  }, []);

  /**
   * 替換單一景點為新項目（使用者從 AI 候選清單中選擇後觸發）。
   * 保留原項目的 id，以維持拖曳排序的穩定性。
   * 替換後對新項目觸發 Places 補充。
   */
  const replaceItem = useCallback((dayIndex: number, itemIndex: number, newItem: ItineraryItem) => {
    const replaced = { ...newItem };
    updateDay(dayIndex, (day) => ({
      ...day,
      items: day.items.map((item, i) => i === itemIndex ? { ...replaced, id: item.id } : item),
    }));
    const city = state.tripPlan?.destination.split(',')[0].trim() || '';
    refreshPlaces([replaced], city);
  }, [updateDay, state.tripPlan, refreshPlaces]);

  /**
   * 取得指定項目的 AI 替換候選清單（3 個備選景點）。
   * 由 Gemini 根據目的地、天氣、原始項目類型生成。
   */
  const fetchReplacementCandidates = useCallback(async (dayIndex: number, itemIndex: number) => {
    if (!state.tripPlan) return [];
    const day = state.tripPlan.dailyPlans[dayIndex];
    if (!day) return [];
    const item = day.items[itemIndex];
    if (!item || item.type === 'transit') return [];

    return getReplacementCandidates(
      item,
      state.tripPlan.destination,
      { description: day.weather.description, precipProbability: day.weather.precipProbability },
    );
  }, [state.tripPlan]);

  /**
   * 確認整日修改：移除現有交通節點，由 Gemini 重新生成合理的交通安排，
   * 再補充 Places 資訊。
   */
  const confirmDayEdit = useCallback(async (dayIndex: number) => {
    if (!state.tripPlan) return;
    const day = state.tripPlan.dailyPlans[dayIndex];
    if (!day) return;

    // 只保留非交通項目，交通由 AI 重新插入
    const nonTransitItems = day.items.filter((it) => it.type !== 'transit');

    try {
      const newItems = await regenerateTransitForDay(
        nonTransitItems,
        state.tripPlan.destination,
        { description: day.weather.description, precipProbability: day.weather.precipProbability },
      );

      updateDay(dayIndex, (d) => ({ ...d, items: newItems }));
      const city = state.tripPlan.destination.split(',')[0].trim();
      // 對新行程中所有項目補充 Places 資訊
      refreshPlaces(newItems, city);
    } catch (err) {
      console.error('Transit regeneration failed:', err);
      // 降級處理：失敗時直接用無交通的項目清單
      updateDay(dayIndex, (d) => ({ ...d, items: nonTransitItems }));
    }
  }, [state.tripPlan, updateDay, refreshPlaces]);

  /**
   * 整日重新生成：由 Gemini 生成全新行程，保留使用者鎖定的項目。
   * 新項目會經過 Nominatim 座標校正與 Places 資訊補充。
   */
  const regenerateDay = useCallback(async (dayIndex: number, preferences: string[]) => {
    if (!state.tripPlan) return;
    const day = state.tripPlan.dailyPlans[dayIndex];
    if (!day) return;

    // 收集鎖定的非交通項目，傳給 AI 作為約束條件
    const lockedItems = day.items.filter((it) => it.locked && it.type !== 'transit');

    const result = await regenerateDayWithAI(
      lockedItems,
      state.tripPlan.destination,
      day.weather,
      preferences,
    );

    // 校正新生成項目的經緯度座標
    const cityName = state.tripPlan.destination.split(',')[0].trim();
    const enrichedItems = await enrichItemsWithCoords(result.items, cityName);

    updateDay(dayIndex, (d) => ({
      ...d,
      items: enrichedItems,
      lodgingArea: result.lodgingArea ?? d.lodgingArea,
    }));

    // 非阻塞地補充 Places 資訊
    refreshPlaces(enrichedItems, cityName);
  }, [state.tripPlan, updateDay, refreshPlaces]);

  /** 載入已儲存的行程（本機或雲端），恢復完整 state */
  const loadTripPlan = useCallback((tripPlan: TripPlan) => {
    const weatherData = tripPlan.dailyPlans.map((d) => d.weather);
    setState({
      loading: false,
      error: '',
      weatherData,
      tripPlan,
      cityName: tripPlan.destination,
    });
  }, []);

  /** 重置所有狀態，回到初始畫面 */
  const reset = () => {
    setState({ loading: false, error: '', weatherData: [], tripPlan: null, cityName: '' });
  };

  return {
    ...state, plan, reset, reorderItems, deleteItem, toggleLock,
    replaceItem, fetchReplacementCandidates, confirmDayEdit, regenerateDay, loadTripPlan,
  };
}
