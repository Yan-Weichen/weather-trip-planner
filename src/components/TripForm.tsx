import { useState } from 'react';
import type { Preference } from '../services/generateItinerary';
import { Utensils, Landmark, Baby, Mountain } from 'lucide-react';
import './TripForm.css';

interface Props {
  onSubmit: (data: {
    destination: string;
    startDate: string;
    endDate: string;
    preferences: Preference[];
  }) => void;
  loading: boolean;
}

const ALL_PREFS: Preference[] = ['美食', '文化', '親子', '戶外'];

export default function TripForm({ onSubmit, loading }: Props) {
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preferences, setPreferences] = useState<Preference[]>([]);

  const togglePref = (p: Preference) => {
    setPreferences((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim() || !startDate || !endDate) return;
    onSubmit({ destination: destination.trim(), startDate, endDate, preferences });
  };

  // min date = today
  const today = new Date().toISOString().slice(0, 10);
  // max date = 16 days from now (Open-Meteo forecast limit)
  const maxDate = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);

  return (
    <form className="trip-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-field">
          <label>目的地</label>
          <input
            type="text"
            placeholder="例如：東京、Paris、首爾"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            required
          />
        </div>
        <div className="form-field">
          <label>出發日期</label>
          <input
            type="date"
            value={startDate}
            min={today}
            max={maxDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className="form-field">
          <label>回程日期</label>
          <input
            type="date"
            value={endDate}
            min={startDate || today}
            max={maxDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>
      <p className="date-limit-hint">※ 天氣預報最多支援未來 16 天（至 {maxDate}）</p>

      <div className="form-field">
        <label>旅遊偏好（可多選）</label>
        <div className="pref-chips">
          {ALL_PREFS.map((p) => (
            <button
              key={p}
              type="button"
              className={`pref-chip ${preferences.includes(p) ? 'active' : ''}`}
              onClick={() => togglePref(p)}
            >
              {p === '美食' && <Utensils size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />}
              {p === '文化' && <Landmark size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />}
              {p === '親子' && <Baby size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />}
              {p === '戶外' && <Mountain size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />}
              {p}
            </button>
          ))}
        </div>
      </div>

      <button type="submit" className="submit-btn" disabled={loading}>
        {loading ? '生成中...' : '生成行程'}
      </button>
    </form>
  );
}
