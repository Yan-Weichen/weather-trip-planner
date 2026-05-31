import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { DayWeather } from '../types';
import { TrendingUp } from 'lucide-react';
import './WeatherChart.css';

interface Props {
  days: DayWeather[];
}

export default function WeatherChart({ days }: Props) {
  if (days.length === 0) return null;

  const data = days.map((d) => {
    const date = new Date(d.date + 'T00:00:00');
    return {
      name: `${date.getMonth() + 1}/${date.getDate()}`,
      maxTemp: Math.round(d.maxTemp),
      minTemp: Math.round(d.minTemp),
      precip: d.precipProbability,
    };
  });

  return (
    <div className="weather-chart">
      <h3 className="section-title"><TrendingUp size={16} className="section-icon" /> 天氣趨勢</h3>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="name" fontSize={12} tick={{ fill: '#888' }} />
          <YAxis yAxisId="temp" fontSize={12} tick={{ fill: '#888' }} unit="°" />
          <YAxis yAxisId="precip" orientation="right" fontSize={12} tick={{ fill: '#888' }} unit="%" domain={[0, 100]} />
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 13, border: '1px solid #eee' }}
            formatter={(value, name) => {
              const labels: Record<string, string> = { maxTemp: '最高溫', minTemp: '最低溫', precip: '降雨機率' };
              const units: Record<string, string> = { maxTemp: '°C', minTemp: '°C', precip: '%' };
              return [`${value}${units[String(name)] ?? ''}`, labels[String(name)] ?? name];
            }}
          />
          <Legend
            formatter={(value: string) => {
              const labels: Record<string, string> = { maxTemp: '最高溫', minTemp: '最低溫', precip: '降雨機率' };
              return labels[value] ?? value;
            }}
          />
          <Bar yAxisId="precip" dataKey="precip" fill="rgba(96,165,250,0.3)" radius={[4, 4, 0, 0]} />
          <Line yAxisId="temp" type="monotone" dataKey="maxTemp" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
          <Line yAxisId="temp" type="monotone" dataKey="minTemp" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
