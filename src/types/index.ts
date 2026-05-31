export interface DayWeather {
  date: string;
  weatherCode: number;
  maxTemp: number;
  minTemp: number;
  precipProbability: number;
  description: string;
  emoji: string;
}

export type ItemType = 'attraction' | 'meal' | 'lodging' | 'transit';

export interface PlaceDetails {
  placeId?: string;
  rating?: number;
  userRatingCount?: number;
  photoUrl?: string;
  openingHours?: string[];
  googleMapsUrl?: string;
}

export interface ItineraryItem {
  id: string;
  type: ItemType;
  name: string;
  address: string;
  lat?: number;
  lon?: number;
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  description: string;
  costMin: number;
  costMax: number;
  category?: 'indoor' | 'outdoor';
  mealType?: 'breakfast' | 'lunch' | 'dinner';
  transitMode?: string;
  locked?: boolean;
  placeDetails?: PlaceDetails;
}

// Keep legacy Attraction for backward compatibility during migration
export interface Attraction {
  name: string;
  lat: number;
  lon: number;
  stayMinutes: number;
  category: 'indoor' | 'outdoor';
  reason: string;
}

export interface DayPlan {
  dayNumber: number;
  date: string;
  weather: DayWeather;
  items: ItineraryItem[];
  dayBudgetMin: number;
  dayBudgetMax: number;
  lodgingArea?: string;
  // Legacy field — kept for transition
  attractions?: Attraction[];
}

export interface TripPlan {
  destination: string;
  startDate: string;
  endDate: string;
  dailyPlans: DayPlan[];
  totalBudgetMin: number;
  totalBudgetMax: number;
}
