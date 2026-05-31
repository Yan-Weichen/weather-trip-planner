import { useState, useEffect, useCallback } from 'react';
import { getSavedTrips, deleteSavedTrip, type SavedTrip } from '../services/storage';
import { fetchTrips, deleteCloudTrip, shareTrip, type CloudTrip } from '../services/trips';
import type { TripPlan } from '../types';
import type { User } from '@supabase/supabase-js';
import { ClipboardList, Smartphone, Cloud, Share2 } from 'lucide-react';
import './SavedTrips.css';

interface Props {
  onLoad: (tripPlan: TripPlan) => void;
  user?: User | null;
}

type UnifiedTrip = {
  id: string;
  name: string;
  date: string;
  days: number;
  tripPlan: TripPlan;
  source: 'local' | 'cloud';
  shareId?: string | null;
};

export default function SavedTrips({ onLoad, user }: Props) {
  const [localTrips, setLocalTrips] = useState<SavedTrip[]>(getSavedTrips);
  const [cloudTrips, setCloudTrips] = useState<CloudTrip[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'local' | 'cloud'>('local');

  const loadCloud = useCallback(async () => {
    if (!user) { setCloudTrips([]); return; }
    setCloudLoading(true);
    try {
      const trips = await fetchTrips();
      setCloudTrips(trips);
    } catch {
      /* ignore */
    } finally {
      setCloudLoading(false);
    }
  }, [user]);

  // Load cloud trips when user is available (not just when panel opens)
  useEffect(() => {
    if (user) loadCloud();
  }, [user, loadCloud]);

  const unify = (): UnifiedTrip[] => {
    if (tab === 'cloud') {
      return cloudTrips.map((t) => ({
        id: t.id,
        name: t.title,
        date: t.updated_at,
        days: t.plan_data.dailyPlans.length,
        tripPlan: t.plan_data,
        source: 'cloud' as const,
        shareId: t.share_id,
      }));
    }
    return localTrips.map((t) => ({
      id: t.id,
      name: t.name,
      date: t.savedAt,
      days: t.tripPlan.dailyPlans.length,
      tripPlan: t.tripPlan,
      source: 'local' as const,
    }));
  };

  const totalCount = localTrips.length + cloudTrips.length;
  if (totalCount === 0 && !open && !user) return null;

  const handleDelete = async (trip: UnifiedTrip) => {
    if (trip.source === 'local') {
      deleteSavedTrip(trip.id);
      setLocalTrips(getSavedTrips());
    } else {
      await deleteCloudTrip(trip.id);
      await loadCloud();
    }
  };

  const handleLoad = (trip: UnifiedTrip) => {
    onLoad(trip.tripPlan);
    setOpen(false);
  };

  const handleShare = async (trip: UnifiedTrip) => {
    try {
      const sid = await shareTrip(trip.id);
      const url = `${window.location.origin}/share/${sid}`;
      await navigator.clipboard.writeText(url);
      alert(`\u5206\u4EAB\u9023\u7D50\u5DF2\u8907\u88FD\uFF01\n${url}`);
      await loadCloud();
    } catch {
      alert('\u5206\u4EAB\u5931\u6557\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66\u3002');
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const trips = unify();

  return (
    <div className="saved-trips no-print">
      <button className="saved-trips-toggle" onClick={() => { setOpen(!open); setLocalTrips(getSavedTrips()); }}>
        <ClipboardList size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} /> {'\u6211\u7684\u884C\u7A0B'} ({localTrips.length}{user ? ` + ${cloudTrips.length}` : ''})
      </button>

      {open && (
        <div className="saved-trips-panel">
          <div className="saved-trips-header">
            <h3>{'\u5DF2\u5132\u5B58\u7684\u884C\u7A0B'}</h3>
            <button className="saved-trips-close" onClick={() => setOpen(false)}>{'\u2715'}</button>
          </div>

          {user && (
            <div className="saved-trips-tabs">
              <button className={`saved-trips-tab ${tab === 'local' ? 'active' : ''}`} onClick={() => setTab('local')}>
                <Smartphone size={13} style={{ verticalAlign: 'text-bottom', marginRight: 3 }} /> {'\u672C\u6A5F'} ({localTrips.length})
              </button>
              <button className={`saved-trips-tab ${tab === 'cloud' ? 'active' : ''}`} onClick={() => setTab('cloud')}>
                <Cloud size={13} style={{ verticalAlign: 'text-bottom', marginRight: 3 }} /> {'\u96F2\u7AEF'} ({cloudTrips.length})
              </button>
            </div>
          )}

          {cloudLoading && tab === 'cloud' ? (
            <div className="saved-trips-empty">{'\u8F09\u5165\u4E2D\u2026'}</div>
          ) : trips.length === 0 ? (
            <div className="saved-trips-empty">{'\u5C1A\u7121\u5132\u5B58\u7684\u884C\u7A0B'}</div>
          ) : (
            <div className="saved-trips-list">
              {trips.map((trip) => (
                <div key={`${trip.source}-${trip.id}`} className="saved-trip-item">
                  <div className="saved-trip-info" onClick={() => handleLoad(trip)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') handleLoad(trip); }}>
                    <div className="saved-trip-name">{trip.name}</div>
                    <div className="saved-trip-meta">
                      {trip.days} {'\u5929'} {'\u00B7'} {formatDate(trip.date)}
                    </div>
                  </div>
                  {trip.source === 'cloud' && (
                    <button
                      className="saved-trip-share"
                      onClick={() => handleShare(trip)}
                      title={trip.shareId ? '\u5DF2\u5206\u4EAB\uFF0C\u9EDE\u64CA\u8907\u88FD\u9023\u7D50' : '\u5206\u4EAB'}
                    >
                      <Share2 size={12} style={{ verticalAlign: 'text-bottom', marginRight: 2 }} />{'\u5206\u4EAB'}
                    </button>
                  )}
                  <button className="saved-trip-delete" onClick={() => handleDelete(trip)} title={'\u522A\u9664'}>{'\u2715'}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
