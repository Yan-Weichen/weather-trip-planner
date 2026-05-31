import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { DayPlan, ItineraryItem, ItemType } from '../types';
import 'leaflet/dist/leaflet.css';
import './TripMap.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export const DAY_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#a855f7', '#ec4899', '#14b8a6'];

function getMappableItems(day: DayPlan): ItineraryItem[] {
  return day.items.filter((item) => item.lat && item.lon && item.type !== 'transit');
}

// SVG icon paths for each type
function getMarkerSvg(type: ItemType, color: string, highlight: boolean): string {
  const size = highlight ? 40 : 32;
  const stroke = highlight ? '#fbbf24' : '#fff';
  const sw = highlight ? 3 : 2;
  const shadow = highlight
    ? 'filter: drop-shadow(0 0 6px rgba(251,191,36,0.6)) drop-shadow(0 2px 4px rgba(0,0,0,0.3));'
    : 'filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));';

  if (type === 'attraction') {
    // Circle with a star
    return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" style="${shadow}">
      <circle cx="20" cy="20" r="17" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>
      <path d="M20 10l2.5 5.5 6 .5-4.5 4 1.5 6-5.5-3.2-5.5 3.2 1.5-6-4.5-4 6-.5z" fill="#fff" opacity="0.95"/>
    </svg>`;
  }

  if (type === 'meal') {
    // Rounded square with fork & knife
    return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" style="${shadow}">
      <rect x="3" y="3" width="34" height="34" rx="8" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>
      <g transform="translate(10,8)" fill="#fff">
        <path d="M4 0v10c0 1.7 1.3 3 3 3v11h2V13c1.7 0 3-1.3 3-3V0h-2v8h-1V0h-2v8h-1V0H4z" opacity="0.95"/>
        <path d="M16 0c-1 4-1 7 0 10v14h2V10c1-3 1-6 0-10h-2z" opacity="0.95"/>
      </g>
    </svg>`;
  }

  if (type === 'lodging') {
    // House shape
    return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" style="${shadow}">
      <path d="M20 4L4 18h5v16h22V18h5L20 4z" fill="${color}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
      <rect x="16" y="22" width="8" height="12" rx="1" fill="#fff" opacity="0.9"/>
      <rect x="17.5" y="23.5" width="2" height="3" rx="0.5" fill="${color}" opacity="0.5"/>
      <rect x="20.5" y="23.5" width="2" height="3" rx="0.5" fill="${color}" opacity="0.5"/>
    </svg>`;
  }

  // Fallback: simple circle
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" style="${shadow}">
    <circle cx="20" cy="20" r="17" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>
  </svg>`;
}

function createTypedIcon(dayColor: string, type: ItemType, highlighted = false) {
  const size = highlighted ? 40 : 32;
  const svg = getMarkerSvg(type, dayColor, highlighted);

  return L.divIcon({
    className: 'custom-marker',
    html: svg,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

const TYPE_LABELS: Record<string, string> = {
  attraction: '景點',
  meal: '餐飲',
  lodging: '住宿',
};

function FitBounds({ dailyPlans }: { dailyPlans: DayPlan[] }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [];
    dailyPlans.forEach((day) =>
      getMappableItems(day).forEach((item) => points.push([item.lat!, item.lon!]))
    );
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
  }, [dailyPlans, map]);
  return null;
}

function FlyToHighlight({ lat, lon }: { lat: number | null; lon: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lon !== null) {
      map.flyTo([lat, lon], 15, { duration: 0.8 });
    }
  }, [lat, lon, map]);
  return null;
}

interface Props {
  dailyPlans: DayPlan[];
  highlightDayIndex?: number | null;
  highlightItemIndex?: number | null;
}

export default function TripMap({ dailyPlans, highlightDayIndex, highlightItemIndex }: Props) {
  const hasHighlight = highlightDayIndex != null && highlightItemIndex != null;

  const highlightItem = hasHighlight
    ? dailyPlans[highlightDayIndex]?.items[highlightItemIndex] ?? null
    : null;
  const canFly = highlightItem && highlightItem.lat && highlightItem.lon;
  const highlightLat = canFly ? highlightItem.lat! : null;
  const highlightLon = canFly ? highlightItem.lon! : null;

  const mapRef = useRef<L.Map | null>(null);

  if (dailyPlans.length === 0) return null;

  return (
    <MapContainer center={[0, 0]} zoom={2} className="trip-map" ref={mapRef}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds dailyPlans={dailyPlans} />
      {hasHighlight && canFly && <FlyToHighlight lat={highlightLat} lon={highlightLon} />}

      {dailyPlans.map((day, dayIdx) => {
        const dayColor = DAY_COLORS[(day.dayNumber - 1) % DAY_COLORS.length];
        const mappable = getMappableItems(day);
        const coords: [number, number][] = mappable.map((item) => [item.lat!, item.lon!]);

        return (
          <div key={day.dayNumber}>
            {mappable.map((item) => {
              const itemIdx = day.items.indexOf(item);
              const isHighlighted = hasHighlight && dayIdx === highlightDayIndex && itemIdx === highlightItemIndex;
              const icon = createTypedIcon(dayColor, item.type, isHighlighted);

              return (
                <Marker key={item.id} position={[item.lat!, item.lon!]} icon={icon}>
                  <Popup>
                    <div className="marker-popup">
                      <strong>{item.name}</strong>
                      <span className="popup-tag" data-category={item.type}>
                        {TYPE_LABELS[item.type]}
                      </span>
                      {item.address && <div className="popup-address">{item.address}</div>}
                      <p>{item.description}</p>
                      <small>
                        第 {day.dayNumber} 天
                        {item.startTime && item.endTime && ` · ${item.startTime}–${item.endTime}`}
                        {item.durationMinutes > 0 && ` · ${item.durationMinutes} 分鐘`}
                      </small>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            {coords.length > 1 && (
              <Polyline positions={coords} color={dayColor} weight={3} opacity={0.7} dashArray="8 6" />
            )}
          </div>
        );
      })}
    </MapContainer>
  );
}
