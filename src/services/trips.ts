/**
 * services/trips.ts — 雲端行程 CRUD（Supabase）
 *
 * 提供對 Supabase PostgreSQL trips 資料表的完整操作：
 * - fetchTrips：讀取目前登入使用者的所有行程（RLS 保護）
 * - saveCloudTrip：新增行程
 * - updateCloudTrip：更新行程內容
 * - deleteCloudTrip：刪除行程
 * - shareTrip：產生公開分享連結（設定 share_id + is_public=true）
 * - fetchSharedTrip：透過 share_id 讀取公開行程（無需登入）
 *
 * 資料表結構（trips）：
 *   id, user_id, title, destination, start_date, end_date,
 *   preferences, plan_data (JSONB), total_budget_min, total_budget_max,
 *   share_id (unique), is_public, created_at, updated_at
 *
 * 安全性：資料表啟用 Row Level Security（RLS），
 * 使用者只能存取自己的行程；is_public=true 的行程任何人可讀。
 */
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
  share_id: string | null;    // null 表示尚未分享
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

/** 讀取目前登入使用者的所有雲端行程，依最後更新時間排序 */
export async function fetchTrips(): Promise<CloudTrip[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data as CloudTrip[];
}

/**
 * 新增行程到雲端。
 * user_id 由 Supabase Auth 自動取得，確保只能存入自己的資料。
 * @param tripPlan 完整行程資料
 * @param title 自訂標題（省略時使用「目的地 + 日期」）
 */
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
    plan_data: tripPlan,          // 完整行程以 JSONB 格式儲存
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

/** 更新現有雲端行程的內容與預算 */
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

/** 刪除指定雲端行程（RLS 確保只能刪除自己的） */
export async function deleteCloudTrip(id: string): Promise<void> {
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/** 產生不可猜測的短 ID（時間戳 base36 + 亂數） */
function generateShareId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * 將行程設為公開分享並回傳分享 ID。
 * 若已分享過，直接回傳原有的 share_id（冪等操作）。
 * 分享 URL 格式：/share/:shareId
 */
export async function shareTrip(tripId: string): Promise<string> {
  // 先檢查是否已有 share_id，避免重複生成
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

/**
 * 透過分享 ID 讀取公開行程（不需登入）。
 * 只回傳 is_public=true 的行程，避免猜測 ID 存取非公開資料。
 */
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
