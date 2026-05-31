import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase 環境變數未設定，雲端功能將無法使用');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
);

export const hasSupabase = !!(supabaseUrl && supabaseAnonKey);
