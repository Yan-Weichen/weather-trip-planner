import type { ItineraryItem } from '../types';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Throttle: max 1 request per second (Nominatim policy)
let lastRequestTime = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, 1050 - (now - lastRequestTime));
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();
}

async function nominatimSearch(query: string): Promise<{ lat: number; lon: number } | null> {
  await throttle();
  try {
    const res = await fetch(
      `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(query)}&limit=1`,
      { headers: { 'User-Agent': 'TravelPlannerApp/1.0' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

/**
 * Extract street address from a full address string.
 * AI often gives: "台北市大安區忠孝東路四段216巷8弄12號"
 * or with store name prefix: "阿宗麵線（台北市萬華區峨眉街8號）"
 * We extract the part that looks like a Chinese street address.
 */
function extractStreetAddress(raw: string): string | null {
  // Match Chinese address pattern: city+district+road+number
  // e.g. 台北市大安區忠孝東路四段216巷8弄12號
  const match = raw.match(
    /[\u4e00-\u9fff]{2,}[市縣][\u4e00-\u9fff]*[區鄉鎮市][\u4e00-\u9fff\d]+[路街道巷弄號樓\d\-]+/,
  );
  if (match) return match[0];

  // Try: content inside parentheses (often address is in brackets)
  const paren = raw.match(/[（(]([^）)]+)[）)]/);
  if (paren) return paren[1];

  return null;
}

export async function geocodeAddress(
  address: string,
  cityHint?: string,
): Promise<{ lat: number; lon: number } | null> {
  const query = cityHint ? `${address}, ${cityHint}` : address;
  return nominatimSearch(query);
}

/**
 * Geocode a meal item with multiple fallback strategies:
 * 1. Full address as-is
 * 2. Extracted street address only (strip restaurant name)
 * 3. Restaurant name + city hint
 */
async function geocodeMeal(
  item: ItineraryItem,
  cityHint: string,
): Promise<{ lat: number; lon: number } | null> {
  // Strategy 1: try full address with city hint
  if (item.address) {
    const r1 = await nominatimSearch(`${item.address}, ${cityHint}`);
    if (r1) return r1;

    // Strategy 2: extract just the street address portion
    const street = extractStreetAddress(item.address);
    if (street && street !== item.address) {
      const r2 = await nominatimSearch(street);
      if (r2) return r2;
    }

    // Strategy 3: try address alone without city hint
    const r3 = await nominatimSearch(item.address);
    if (r3) return r3;
  }

  // Strategy 4: try restaurant name + city
  if (item.name) {
    const r4 = await nominatimSearch(`${item.name}, ${cityHint}`);
    if (r4) return r4;
  }

  return null;
}

export async function enrichItemsWithCoords(
  items: ItineraryItem[],
  cityHint: string,
): Promise<ItineraryItem[]> {
  const results: ItineraryItem[] = [];

  for (const item of items) {
    // Skip transit or items that already have valid coords
    if (item.type === 'transit' || (item.lat && item.lon)) {
      results.push(item);
      continue;
    }

    if (item.type === 'meal') {
      // Meals: use multi-strategy geocoding
      const coords = await geocodeMeal(item, cityHint);
      results.push(coords ? { ...item, lat: coords.lat, lon: coords.lon } : item);
    } else {
      // Attractions / lodging: standard geocoding
      const searchStr = item.address || item.name;
      const coords = await geocodeAddress(searchStr, cityHint);
      results.push(coords ? { ...item, lat: coords.lat, lon: coords.lon } : item);
    }
  }

  // Last resort: meals still without coords → borrow from nearest neighbor
  return fillMissingMealCoords(results);
}

/**
 * For any meal item that still has no valid coords,
 * copy coordinates from the nearest non-transit neighbor that has coords.
 * Adds a tiny offset so markers don't stack exactly on top of each other.
 */
function fillMissingMealCoords(items: ItineraryItem[]): ItineraryItem[] {
  return items.map((item, idx) => {
    if (item.type !== 'meal' || (item.lat && item.lon)) return item;

    const neighborCoords = findNearestNeighborCoords(items, idx);
    if (neighborCoords) {
      const jitter = () => (Math.random() - 0.5) * 0.002;
      return {
        ...item,
        lat: neighborCoords.lat + jitter(),
        lon: neighborCoords.lon + jitter(),
      };
    }
    return item;
  });
}

function findNearestNeighborCoords(
  items: ItineraryItem[],
  idx: number,
): { lat: number; lon: number } | null {
  for (let dist = 1; dist < items.length; dist++) {
    for (const dir of [-1, 1]) {
      const i = idx + dist * dir;
      if (i >= 0 && i < items.length) {
        const neighbor = items[i];
        if (neighbor.type !== 'transit' && neighbor.lat && neighbor.lon) {
          return { lat: neighbor.lat, lon: neighbor.lon };
        }
      }
    }
  }
  return null;
}
