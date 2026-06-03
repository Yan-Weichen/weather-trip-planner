/**
 * utils/schedule.ts — 行程時間軸計算
 *
 * 根據每個項目的 durationMinutes，從一天的起始時間開始
 * 依序計算每個項目的 startTime 和 endTime。
 * 住宿項目沒有 endTime（只標記入住時間）。
 */
import type { ItineraryItem } from '../types';

/**
 * 將時間字串加上指定分鐘數，回傳新的時間字串。
 * @param time 時間字串，格式 "HH:mm"
 * @param minutes 要加上的分鐘數
 * @returns 新的時間字串，最大值為 "23:59"
 */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  // 超過 23:59 時截斷，避免跨日顯示問題
  const clampedTotal = Math.min(total, 23 * 60 + 59);
  const newH = Math.floor(clampedTotal / 60);
  const newM = clampedTotal % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/**
 * 對一天的行程項目依序計算時間軸。
 *
 * 邏輯：
 * - 從 dayStartTime 開始（預設 08:00）
 * - 每個項目的 startTime = 上一個項目的 endTime
 * - endTime = startTime + durationMinutes
 * - 住宿（lodging）duration 視為 0，且不設 endTime
 *
 * @param items 行程項目陣列（已排序）
 * @param dayStartTime 一天開始時間，預設 "08:00"
 * @returns 注入了 startTime / endTime 的新項目陣列
 */
export function computeTimeline(items: ItineraryItem[], dayStartTime = '08:00'): ItineraryItem[] {
  let current = dayStartTime;

  return items.map((item) => {
    const startTime = current;
    // 住宿不佔用時間軸（入住後行程結束）
    const duration = item.type === 'lodging' ? 0 : item.durationMinutes;
    const endTime = addMinutes(startTime, duration);
    current = endTime; // 下一個項目從此時間開始

    return {
      ...item,
      startTime,
      endTime: item.type === 'lodging' ? undefined : endTime,
    };
  });
}
