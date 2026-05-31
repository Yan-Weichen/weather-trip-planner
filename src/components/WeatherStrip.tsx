import type { DayWeather } from '../types';
import './WeatherStrip.css';

interface Props {
  days: DayWeather[];
}

export default function WeatherStrip({ days }: Props) {
  if (days.length === 0) return null;

  return (
    <div className="weather-strip">
      {days.map((d) => (
        <div key={d.date} className="weather-card">
          <div className="weather-date">{formatDate(d.date)}</div>
          <div className="weather-emoji">{d.emoji}</div>
          <div className="weather-desc">{d.description}</div>
          <div className="weather-temp">
            <span className="temp-max">{Math.round(d.maxTemp)}°</span>
            <span className="temp-sep">/</span>
            <span className="temp-min">{Math.round(d.minTemp)}°</span>
          </div>
          <div className="weather-precip">💧 {d.precipProbability}%</div>
        </div>
      ))}
    </div>
  );
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = weekdays[date.getDay()];
  return `${m}/${d} (${w})`;
}
