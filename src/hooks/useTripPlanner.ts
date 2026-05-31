import { useState, useCallback } from 'react';
import { geocodeCity, getForecast } from '../services/weather';
import { generateItinerary, type Preference } from '../services/generateItinerary';
import { generateItineraryWithAI, getReplacementCandidates, regenerateTransitForDay, regenerateDayWithAI } from '../services/gemini';
import { computeTimeline } from '../utils/schedule';
import { enrichItemsWithCoords } from '../services/geocode';
import { enrichItemsWithPlaces } from '../services/places';
import type { DayWeather, TripPlan, DayPlan, ItineraryItem } from '../types';

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

function recalcDay(day: DayPlan): DayPlan {
  const items = computeTimeline(day.items, '08:00');
  const dayBudgetMin = items.reduce((s, it) => s + it.costMin, 0);
  const dayBudgetMax = items.reduce((s, it) => s + it.costMax, 0);
  return { ...day, items, dayBudgetMin, dayBudgetMax };
}

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

  const plan = async (input: TripInput) => {
    setState({ loading: true, error: '', weatherData: [], tripPlan: null, cityName: '' });

    try {
      const geo = await geocodeCity(input.destination);
      const cityName = `${geo.name}, ${geo.country}`;

      const weatherData = await getForecast(
        geo.latitude, geo.longitude, input.startDate, input.endDate,
      );

      const days = weatherData.length;
      let tripPlan: TripPlan;

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

      tripPlan = {
        ...tripPlan,
        dailyPlans: await Promise.all(
          tripPlan.dailyPlans.map(async (day) => ({
            ...day,
            items: await enrichItemsWithCoords(day.items, geo.name),
          })),
        ),
      };
      tripPlan = recalcPlan(tripPlan);

      // Enrich with Google Places details (photos, ratings, etc.) — non-blocking
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

  const reorderItems = useCallback((dayIndex: number, fromIndex: number, toIndex: number) => {
    updateDay(dayIndex, (day) => {
      const items = [...day.items];
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      return { ...day, items };
    });
  }, [updateDay]);

  const deleteItem = useCallback((dayIndex: number, itemIndex: number) => {
    updateDay(dayIndex, (day) => ({
      ...day,
      items: day.items.filter((_, i) => i !== itemIndex),
    }));
  }, [updateDay]);

  const toggleLock = useCallback((dayIndex: number, itemIndex: number) => {
    updateDay(dayIndex, (day) => ({
      ...day,
      items: day.items.map((item, i) =>
        i === itemIndex ? { ...item, locked: !item.locked } : item,
      ),
    }));
  }, [updateDay]);

  const refreshPlaces = useCallback((items: ItineraryItem[], city: string) => {
    enrichItemsWithPlaces(items, city).then(() => {
      setState((prev) => prev.tripPlan ? { ...prev, tripPlan: { ...prev.tripPlan! } } : prev);
    }).catch(() => {});
  }, []);

  const replaceItem = useCallback((dayIndex: number, itemIndex: number, newItem: ItineraryItem) => {
    const replaced = { ...newItem };
    updateDay(dayIndex, (day) => ({
      ...day,
      items: day.items.map((item, i) => i === itemIndex ? { ...replaced, id: item.id } : item),
    }));
    const city = state.tripPlan?.destination.split(',')[0].trim() || '';
    refreshPlaces([replaced], city);
  }, [updateDay, state.tripPlan, refreshPlaces]);

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

  const confirmDayEdit = useCallback(async (dayIndex: number) => {
    if (!state.tripPlan) return;
    const day = state.tripPlan.dailyPlans[dayIndex];
    if (!day) return;

    const nonTransitItems = day.items.filter((it) => it.type !== 'transit');

    try {
      const newItems = await regenerateTransitForDay(
        nonTransitItems,
        state.tripPlan.destination,
        { description: day.weather.description, precipProbability: day.weather.precipProbability },
      );

      updateDay(dayIndex, (d) => ({ ...d, items: newItems }));
      const city = state.tripPlan.destination.split(',')[0].trim();
      refreshPlaces(newItems, city);
    } catch (err) {
      console.error('Transit regeneration failed:', err);
      // Fallback: just use non-transit items without transit
      updateDay(dayIndex, (d) => ({ ...d, items: nonTransitItems }));
    }
  }, [state.tripPlan, updateDay, refreshPlaces]);

  const regenerateDay = useCallback(async (dayIndex: number, preferences: string[]) => {
    if (!state.tripPlan) return;
    const day = state.tripPlan.dailyPlans[dayIndex];
    if (!day) return;

    const lockedItems = day.items.filter((it) => it.locked && it.type !== 'transit');

    const result = await regenerateDayWithAI(
      lockedItems,
      state.tripPlan.destination,
      day.weather,
      preferences,
    );

    // Enrich new items with accurate coordinates via Nominatim
    const cityName = state.tripPlan.destination.split(',')[0].trim();
    const enrichedItems = await enrichItemsWithCoords(result.items, cityName);

    updateDay(dayIndex, (d) => ({
      ...d,
      items: enrichedItems,
      lodgingArea: result.lodgingArea ?? d.lodgingArea,
    }));

    // Enrich with Places details — non-blocking
    refreshPlaces(enrichedItems, cityName);
  }, [state.tripPlan, updateDay, refreshPlaces]);

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

  const reset = () => {
    setState({ loading: false, error: '', weatherData: [], tripPlan: null, cityName: '' });
  };

  return {
    ...state, plan, reset, reorderItems, deleteItem, toggleLock,
    replaceItem, fetchReplacementCandidates, confirmDayEdit, regenerateDay, loadTripPlan,
  };
}
