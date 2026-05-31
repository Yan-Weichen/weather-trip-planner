import type { DayWeather, TripPlan, ItineraryItem } from '../types';

export type Preference = '美食' | '文化' | '親子' | '戶外';

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function makeItem(overrides: Partial<ItineraryItem> & { name: string; type: ItineraryItem['type'] }): ItineraryItem {
  return {
    id: uid(),
    address: '',
    durationMinutes: 60,
    description: '',
    costMin: 0,
    costMax: 0,
    ...overrides,
  };
}

export async function generateItinerary(
  destination: string,
  days: number,
  _preferences: Preference[],
  weatherData: DayWeather[],
  startDate: string,
  endDate: string,
  centerLat = 0,
  centerLon = 0,
): Promise<TripPlan> {
  await new Promise((r) => setTimeout(r, 1500));

  const offset = () => (Math.random() - 0.5) * 0.06;

  const dailyPlans = weatherData.slice(0, days).map((weather, i) => {
    const isRainy = weather.precipProbability > 60;
    const cat = isRainy ? 'indoor' as const : 'outdoor' as const;

    const items: ItineraryItem[] = [
      makeItem({ type: 'meal', mealType: 'breakfast', name: `${destination}早餐店`, durationMinutes: 30, costMin: 60, costMax: 120, description: '當地特色早餐', lat: centerLat + offset(), lon: centerLon + offset() }),
      makeItem({ type: 'transit', transitMode: '捷運', name: '前往上午景點', durationMinutes: 15, costMin: 20, costMax: 20, description: '搭乘大眾運輸' }),
      makeItem({ type: 'attraction', category: cat, name: `${destination}${isRainy ? '博物館' : '公園'}`, durationMinutes: 90, costMin: 0, costMax: 100, description: isRainy ? '雨天適合室內參觀' : '晴天適合戶外漫步', lat: centerLat + offset(), lon: centerLon + offset() }),
      makeItem({ type: 'transit', transitMode: '步行', name: '步行前往午餐', durationMinutes: 10, costMin: 0, costMax: 0, description: '步行即達' }),
      makeItem({ type: 'meal', mealType: 'lunch', name: `${destination}午餐餐廳`, durationMinutes: 60, costMin: 200, costMax: 400, description: '享用當地特色料理', lat: centerLat + offset(), lon: centerLon + offset() }),
      makeItem({ type: 'attraction', category: cat, name: `${destination}${isRainy ? '購物中心' : '古蹟'}`, durationMinutes: 90, costMin: 0, costMax: 200, description: isRainy ? '室內購物不受雨天影響' : '好天氣適合探索歷史建築', lat: centerLat + offset(), lon: centerLon + offset() }),
      makeItem({ type: 'transit', transitMode: '捷運', name: '前往晚餐地點', durationMinutes: 20, costMin: 25, costMax: 25, description: '搭乘大眾運輸' }),
      makeItem({ type: 'meal', mealType: 'dinner', name: `${destination}晚餐`, durationMinutes: 60, costMin: 250, costMax: 500, description: '品嚐在地美食', lat: centerLat + offset(), lon: centerLon + offset() }),
      makeItem({ type: 'lodging', name: `${destination}旅館`, durationMinutes: 0, costMin: 2000, costMax: 3500, description: '鄰近車站，交通便利', lat: centerLat + offset(), lon: centerLon + offset() }),
    ];

    const dayBudgetMin = items.reduce((s, it) => s + it.costMin, 0);
    const dayBudgetMax = items.reduce((s, it) => s + it.costMax, 0);

    return {
      dayNumber: i + 1,
      date: weather.date,
      weather,
      items,
      dayBudgetMin,
      dayBudgetMax,
    };
  });

  const totalBudgetMin = dailyPlans.reduce((s, d) => s + d.dayBudgetMin, 0);
  const totalBudgetMax = dailyPlans.reduce((s, d) => s + d.dayBudgetMax, 0);

  return { destination, startDate, endDate, dailyPlans, totalBudgetMin, totalBudgetMax };
}
