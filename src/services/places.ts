/**
 * services/places.ts — Google Places API (New) 景點資訊豐富化
 *
 * 在 AI 生成行程之後，對每個非交通項目呼叫 Google Places API，
 * 補充照片、評分、評論數、Google Maps 連結等詳細資訊。
 *
 * 使用 Places API (New) 的 Text Search 端點：
 *   POST https://places.googleapis.com/v1/places:searchText
 *
 * 篩選策略：
 *   回傳最多 5 筆結果，選第一個有評論數（userRatingCount > 0）的，
 *   避免選到私人住宅、無資訊的地點等錯誤匹配。
 *
 * 節流：每次請求間隔至少 200ms，避免超過 API QPS 限制。
 *
 * 費用：每次 Text Search 約 $0.032，新帳號有 $300 免費抵免。
 */
import type { PlaceDetails } from '../types';

const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string;

/** 是否已設定 Places API 金鑰 */
export const hasPlacesApi = !!API_KEY;

/** Places API Text Search 回應格式（僅列出使用到的欄位） */
interface TextSearchResult {
  places?: {
    id: string;
    displayName?: { text: string };
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
    currentOpeningHours?: { weekdayDescriptions?: string[] };
    regularOpeningHours?: { weekdayDescriptions?: string[] };
    photos?: { name: string }[];   // photo.name 用來組成圖片 URL
  }[];
}

// 記錄上次請求時間，用於節流控制
let lastCall = 0;

/** 確保相鄰兩次請求間隔至少 200ms */
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, 200 - (now - lastCall));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

/**
 * 搜尋單一地點，回傳 Google Places 詳細資訊。
 * 以「name + address」組成搜尋文字，篩選有評論的結果。
 *
 * @returns PlaceDetails 或 null（找不到或無評論時）
 */
export async function searchPlace(
  name: string,
  address: string,
  cityHint: string,
): Promise<PlaceDetails | null> {
  if (!API_KEY) return null;
  await throttle();

  const textQuery = `${name} ${address || cityHint}`;

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        // FieldMask：只請求需要的欄位，減少回應大小與費用
        'X-Goog-FieldMask': 'places.id,places.rating,places.userRatingCount,places.googleMapsUri,places.regularOpeningHours.weekdayDescriptions,places.photos',
      },
      body: JSON.stringify({
        textQuery,
        languageCode: 'zh-TW',
        maxResultCount: 5, // 取多筆以便篩選有評論的結果
      }),
    });

    if (!res.ok) return null;

    const data: TextSearchResult = await res.json();
    if (!data.places?.length) return null;

    // 選第一個有評論數的結果，避免選到私人住宅等無資訊地點
    const place = data.places.find((p) => p.userRatingCount && p.userRatingCount > 0) ?? null;
    if (!place) return null;

    // 組成景點照片 URL（使用 Places Media API）
    let photoUrl: string | undefined;
    if (place.photos?.[0]) {
      photoUrl = `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxHeightPx=300&maxWidthPx=400&key=${API_KEY}`;
    }

    return {
      placeId: place.id,
      rating: place.rating,
      userRatingCount: place.userRatingCount,
      photoUrl,
      openingHours: place.regularOpeningHours?.weekdayDescriptions,
      googleMapsUrl: place.googleMapsUri,
    };
  } catch {
    return null;
  }
}

/**
 * 批次為多個行程項目補充 Google Places 資訊。
 * 跳過交通項目與已有 placeId 的項目（避免重複請求）。
 *
 * 注意：此函式直接 mutate 傳入的 items 物件（in-place 修改），
 * 呼叫端需在完成後透過 setState 更新 React 狀態（見 useTripPlanner.ts）。
 *
 * @param items 行程項目陣列
 * @param cityHint 城市名稱，用於輔助搜尋
 */
export async function enrichItemsWithPlaces(
  items: { name: string; address: string; type: string; placeDetails?: PlaceDetails }[],
  cityHint: string,
): Promise<void> {
  for (const item of items) {
    if (item.type === 'transit') continue;           // 交通項目不需要景點資訊
    if (item.placeDetails?.placeId) continue;        // 已有資訊則跳過
    const details = await searchPlace(item.name, item.address, cityHint);
    if (details) {
      item.placeDetails = details;
    }
  }
}
