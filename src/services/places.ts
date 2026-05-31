import type { PlaceDetails } from '../types';

const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string;

export const hasPlacesApi = !!API_KEY;

interface TextSearchResult {
  places?: {
    id: string;
    displayName?: { text: string };
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
    currentOpeningHours?: { weekdayDescriptions?: string[] };
    regularOpeningHours?: { weekdayDescriptions?: string[] };
    photos?: { name: string }[];
  }[];
}

// Throttle: max 1 request per 200ms to stay under QPS limits
let lastCall = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, 200 - (now - lastCall));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

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
        'X-Goog-FieldMask': 'places.id,places.rating,places.userRatingCount,places.googleMapsUri,places.regularOpeningHours.weekdayDescriptions,places.photos',
      },
      body: JSON.stringify({
        textQuery,
        languageCode: 'zh-TW',
        maxResultCount: 1,
      }),
    });

    if (!res.ok) return null;

    const data: TextSearchResult = await res.json();
    const place = data.places?.[0];
    if (!place) return null;

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

export async function enrichItemsWithPlaces(
  items: { name: string; address: string; type: string; placeDetails?: PlaceDetails }[],
  cityHint: string,
): Promise<void> {
  for (const item of items) {
    if (item.type === 'transit') continue;
    if (item.placeDetails?.placeId) continue; // already enriched
    const details = await searchPlace(item.name, item.address, cityHint);
    if (details) {
      item.placeDetails = details;
    }
  }
}
