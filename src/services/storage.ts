/**
 * services/storage.ts — 本機行程儲存（localStorage）
 *
 * 不需登入即可使用的本機儲存功能。
 * 行程資料以 JSON 格式儲存在瀏覽器的 localStorage，
 * key 為 "travel-planner-saved-trips"。
 *
 * 與雲端儲存（trips.ts）並行存在：
 * - 未登入 → 只存本機
 * - 已登入 → 同時存本機與雲端
 */
import type { TripPlan } from '../types';

const STORAGE_KEY = 'travel-planner-saved-trips';

export interface SavedTrip {
  id: string;        // 本機唯一 ID（時間戳 + 亂數）
  name: string;      // 行程名稱（目的地 + 日期）
  savedAt: string;   // 儲存時間（ISO 8601）
  tripPlan: TripPlan;
}

/** 產生簡短的本機唯一 ID */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** 讀取所有本機儲存的行程，解析失敗時回傳空陣列 */
export function getSavedTrips(): SavedTrip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedTrip[];
  } catch {
    return [];
  }
}

/**
 * 儲存行程到 localStorage，插入到清單最前面（最新在上）。
 * @param tripPlan 要儲存的行程
 * @param name 自訂名稱（省略時使用「目的地 + 日期」）
 */
export function saveTrip(tripPlan: TripPlan, name?: string): SavedTrip {
  const trips = getSavedTrips();
  const label = name || `${tripPlan.destination} ${tripPlan.startDate}`;
  const saved: SavedTrip = {
    id: uid(),
    name: label,
    savedAt: new Date().toISOString(),
    tripPlan,
  };
  trips.unshift(saved); // 最新的放最前面
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  return saved;
}

/** 依 ID 刪除指定的本機行程 */
export function deleteSavedTrip(id: string): void {
  const trips = getSavedTrips().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}
