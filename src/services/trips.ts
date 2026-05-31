import { supabase, hasSupabase } from './supabase';
import type { TripPlan } from '../types';

export interface CloudTrip {
  id: string;
  title: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  preferences: string[];
  plan_data: TripPlan;
  total_budget_min: number;
  total_budget_max: number;
  share_id: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchTrips(): Promise<CloudTrip[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data as CloudTrip[];
}

export async function saveCloudTrip(tripPlan: TripPlan, title?: string): Promise<CloudTrip> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('請先登入');

  const row = {
    user_id: user.id,
    title: title || `${tripPlan.destination} ${tripPlan.startDate}`,
    destination: tripPlan.destination,
    start_date: tripPlan.startDate || null,
    end_date: tripPlan.endDate || null,
    preferences: [] as string[],
    plan_data: tripPlan,
    total_budget_min: tripPlan.totalBudgetMin,
    total_budget_max: tripPlan.totalBudgetMax,
  };

  const { data, error } = await supabase
    .from('trips')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as CloudTrip;
}

export async function updateCloudTrip(id: string, tripPlan: TripPlan): Promise<CloudTrip> {
  const { data, error } = await supabase
    .from('trips')
    .update({
      plan_data: tripPlan,
      total_budget_min: tripPlan.totalBudgetMin,
      total_budget_max: tripPlan.totalBudgetMax,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as CloudTrip;
}

export async function deleteCloudTrip(id: string): Promise<void> {
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

function generateShareId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function shareTrip(tripId: string): Promise<string> {
  // Check if already shared
  const { data: existing } = await supabase
    .from('trips')
    .select('share_id')
    .eq('id', tripId)
    .single();

  if (existing?.share_id) return existing.share_id;

  const shareId = generateShareId();
  const { error } = await supabase
    .from('trips')
    .update({ share_id: shareId, is_public: true })
    .eq('id', tripId);
  if (error) throw error;
  return shareId;
}

export async function fetchSharedTrip(shareId: string): Promise<CloudTrip | null> {
  if (!hasSupabase) return null;
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('share_id', shareId)
    .eq('is_public', true)
    .single();
  if (error) return null;
  return data as CloudTrip;
}
