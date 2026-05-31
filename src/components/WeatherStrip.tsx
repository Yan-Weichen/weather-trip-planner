import type { DayWeather } from '../types';
import './WeatherStrip.css';

interface Props {
  days: DayWeather[];
}

function getWeatherType(code: number): 'sunny' | 'cloudy' | 'rainy' {
  if (code <= 1) return 'sunny';
  if (code <= 3 || code === 45 || code === 48) return 'cloudy';
  return 'rainy';
}

export default function WeatherStrip({ days }: Props) {
  if (days.length === 0) return null;

  return (
    <div className="weather-strip">
      {days.map((d) => (
        <div key={d.date} className="weather-card">
          <div className="weather-date">{formatDate(d.date)}</div>
          <div className={`weather-emoji weather-emoji--${getWeatherType(d.weatherCode)}`}>
            <span className="emoji-icon">{d.emoji}</span>
            {getWeatherType(d.weatherCode) === 'rainy' && (
              <span className="emoji-rain" aria-hidden="true">
                <span className="rain-drop" />
                <span className="rain-drop" />
                <span className="rain-drop" />
              </span>
            )}
          </div>
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
