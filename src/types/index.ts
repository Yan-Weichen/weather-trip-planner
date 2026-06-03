/**
 * types/index.ts — 全域型別定義
 *
 * 定義整個應用程式共用的資料結構：
 * - DayWeather：單日天氣預報
 * - ItineraryItem：行程中的單一項目（景點、餐飲、住宿、交通）
 * - PlaceDetails：Google Places API 回傳的景點詳細資訊
 * - DayPlan：單日完整行程
 * - TripPlan：整趟旅行計畫（頂層結構）
 */

/** 單日天氣預報資料（來自 Open-Meteo API） */
export interface DayWeather {
  date: string;              // 日期，格式 YYYY-MM-DD
  weatherCode: number;       // WMO 天氣代碼（0=晴、3=多雲、61=小雨等）
  maxTemp: number;           // 最高氣溫（°C）
  minTemp: number;           // 最低氣溫（°C）
  precipProbability: number; // 降雨機率（0–100）
  description: string;       // 天氣文字描述，例如「晴天」
  emoji: string;             // 對應天氣的 emoji
}

/** 行程項目類型 */
export type ItemType = 'attraction' | 'meal' | 'lodging' | 'transit';

/** Google Places API 補充的景點詳細資訊（非同步載入，可能為 undefined） */
export interface PlaceDetails {
  placeId?: string;          // Google Places 唯一 ID
  rating?: number;           // 評分（1.0–5.0）
  userRatingCount?: number;  // 評論數
  photoUrl?: string;         // 景點照片 URL
  openingHours?: string[];   // 每週營業時間描述
  googleMapsUrl?: string;    // Google Maps 連結
}

/**
 * 行程中的單一項目，由 Gemini AI 生成後可由使用者編輯。
 * placeDetails 欄位由 Google Places API 非同步補充。
 */
export interface ItineraryItem {
  id: string;                          // 前端產生的唯一 ID（用於拖曳排序識別）
  type: ItemType;                      // 項目類型
  name: string;                        // 地點名稱
  address: string;                     // 完整地址（供 Nominatim 地理編碼）
  lat?: number;                        // 緯度（地圖標記用）
  lon?: number;                        // 經度（地圖標記用）
  startTime?: string;                  // 開始時間，格式 HH:mm（前端計算）
  endTime?: string;                    // 結束時間，格式 HH:mm
  durationMinutes: number;             // 停留或移動分鐘數
  description: string;                 // 推薦理由（繁體中文，AI 生成）
  costMin: number;                     // 預估最低花費（台幣）
  costMax: number;                     // 預估最高花費（台幣）
  category?: 'indoor' | 'outdoor';    // 景點類型（影響雨天排程）
  mealType?: 'breakfast' | 'lunch' | 'dinner'; // 餐別
  transitMode?: string;                // 交通方式，例如「捷運」「步行」
  locked?: boolean;                    // 鎖定後重新生成不會被替換
  placeDetails?: PlaceDetails;         // Places API 補充資訊（照片、評分等）
}

// 保留舊版 Attraction 型別以維持向後相容性
export interface Attraction {
  name: string;
  lat: number;
  lon: number;
  stayMinutes: number;
  category: 'indoor' | 'outdoor';
  reason: string;
}

/** 單日完整行程，包含天氣、各項目清單、當日預算 */
export interface DayPlan {
  dayNumber: number;         // 第幾天（從 1 開始）
  date: string;              // 日期，格式 YYYY-MM-DD
  weather: DayWeather;       // 當日天氣
  items: ItineraryItem[];    // 當日行程項目（含交通）
  dayBudgetMin: number;      // 當日預估最低費用（台幣）
  dayBudgetMax: number;      // 當日預估最高費用（台幣）
  lodgingArea?: string;      // 住宿區域描述
  /** @deprecated 舊版欄位，保留相容性 */
  attractions?: Attraction[];
}

/** 整趟旅行計畫（頂層結構，存入 localStorage 或 Supabase） */
export interface TripPlan {
  destination: string;       // 目的地名稱（含國家，例如「Tokyo, Japan」）
  startDate: string;         // 出發日期，格式 YYYY-MM-DD
  endDate: string;           // 回程日期，格式 YYYY-MM-DD
  dailyPlans: DayPlan[];     // 每日行程陣列
  totalBudgetMin: number;    // 全程預估最低費用（台幣）
  totalBudgetMax: number;    // 全程預估最高費用（台幣）
}
