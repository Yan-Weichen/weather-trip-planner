import type { TripPlan } from '../types';

const STORAGE_KEY = 'travel-planner-saved-trips';

export interface SavedTrip {
  id: string;
  name: string;
  savedAt: string;
  tripPlan: TripPlan;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function getSavedTrips(): SavedTrip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedTrip[];
  } catch {
    return [];
  }
}

export function saveTrip(tripPlan: TripPlan, name?: string): SavedTrip {
  const trips = getSavedTrips();
  const label = name || `${tripPlan.destination} ${tripPlan.startDate}`;
  const saved: SavedTrip = {
    id: uid(),
    name: label,
    savedAt: new Date().toISOString(),
    tripPlan,
  };
  trips.unshift(saved);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  return saved;
}

export function deleteSavedTrip(id: string): void {
  const trips = getSavedTrips().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}
