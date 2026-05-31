import type { ItineraryItem } from '../types';

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const clampedTotal = Math.min(total, 23 * 60 + 59);
  const newH = Math.floor(clampedTotal / 60);
  const newM = clampedTotal % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

export function computeTimeline(items: ItineraryItem[], dayStartTime = '08:00'): ItineraryItem[] {
  let current = dayStartTime;

  return items.map((item) => {
    const startTime = current;
    const duration = item.type === 'lodging' ? 0 : item.durationMinutes;
    const endTime = addMinutes(startTime, duration);
    current = endTime;

    return {
      ...item,
      startTime,
      endTime: item.type === 'lodging' ? undefined : endTime,
    };
  });
}
