import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchSharedTrip } from '../services/trips';
import Itinerary from '../components/Itinerary';
import TripMap, { DAY_COLORS } from '../components/TripMap';
import BudgetChart from '../components/BudgetChart';
import type { TripPlan } from '../types';
import './SharedTrip.css';

export default function SharedTrip() {
  const { shareId } = useParams<{ shareId: string }>();
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shareId) return;
    fetchSharedTrip(shareId)
      .then((trip) => {
        if (trip) {
          setTripPlan(trip.plan_data);
        } else {
          setError('\u627E\u4E0D\u5230\u6B64\u884C\u7A0B\uFF0C\u53EF\u80FD\u5DF2\u522A\u9664\u6216\u672A\u516C\u958B\u3002');
        }
      })
      .catch(() => setError('\u8F09\u5165\u5931\u6557\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66\u3002'))
      .finally(() => setLoading(false));
  }, [shareId]);

  if (loading) {
    return (
      <div className="shared-page">
        <div className="shared-loading">{'\u8F09\u5165\u4E2D\u2026'}</div>
      </div>
    );
  }

  if (error || !tripPlan) {
    return (
      <div className="shared-page">
        <div className="shared-error">
          <h2>{error || '\u884C\u7A0B\u4E0D\u5B58\u5728'}</h2>
          <Link to="/" className="shared-back">{'\u2190'} {'\u56DE\u5230\u9996\u9801'}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="shared-page">
      <header className="shared-header">
        <Link to="/" className="shared-back-link">{'\u2190'} {'\u56DE\u5230\u9996\u9801'}</Link>
        <h1>{tripPlan.destination}</h1>
        <p className="shared-dates">{tripPlan.startDate} ~ {tripPlan.endDate}</p>
        <div className="shared-badge">{'\u{1F517}'} {'\u5206\u4EAB\u7684\u884C\u7A0B\uFF08\u552F\u8B80\uFF09'}</div>
      </header>

      <main className="shared-main">
        {tripPlan.totalBudgetMin > 0 && (
          <div className="shared-budget">
            {'\u{1F4B0}'} {'\u9810\u4F30\u8CBB\u7528\uFF1A'}NT${tripPlan.totalBudgetMin.toLocaleString()}{'\u2013'}{tripPlan.totalBudgetMax.toLocaleString()}
          </div>
        )}

        <div className="shared-layout">
          <div className="shared-itinerary">
            <Itinerary dailyPlans={tripPlan.dailyPlans} />
          </div>
          <div className="shared-map-col">
            <div className="map-sticky">
              <TripMap dailyPlans={tripPlan.dailyPlans} />
              <div className="map-legend">
                {tripPlan.dailyPlans.map((day, i) => (
                  <span key={day.dayNumber} className="legend-item">
                    <span className="legend-dot" style={{ background: DAY_COLORS[i % DAY_COLORS.length] }} />
                    {'\u7B2C'} {day.dayNumber} {'\u5929'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <BudgetChart tripPlan={tripPlan} />
      </main>
    </div>
  );
}
