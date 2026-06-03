/**
 * services/supabase.ts — Supabase 客戶端初始化
 *
 * Supabase 是本專案的後端服務，提供：
 * - Auth：Email 帳號註冊 / 登入 / 登出
 * - PostgreSQL：雲端行程儲存（trips 資料表）
 *
 * 環境變數（需設定在 .env.local）：
 * - VITE_SUPABASE_URL：Supabase 專案 URL
 * - VITE_SUPABASE_ANON_KEY：公開的匿名金鑰（前端使用，受 RLS 保護）
 *
 * hasSupabase：當環境變數未設定時為 false，
 * 各功能模組檢查此旗標以決定是否啟用雲端功能。
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase 環境變數未設定，雲端功能將無法使用');
}

/** Supabase 客戶端實例，供各 service 模組共用 */
export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
);

/** 是否已設定 Supabase 環境變數（false 時隱藏登入與雲端儲存 UI） */
export const hasSupabase = !!(supabaseUrl && supabaseAnonKey);
