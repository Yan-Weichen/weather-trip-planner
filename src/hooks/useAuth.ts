/**
 * hooks/useAuth.ts — Supabase 登入狀態管理 Hook
 *
 * 封裝 Supabase Auth 的所有操作，提供給元件使用：
 * - user：目前登入的使用者（null 表示未登入）
 * - loading：初始化讀取 session 時為 true
 * - signUp / signIn / signOut：帳號操作
 * - hasSupabase：環境變數未設定時為 false，元件可據此隱藏登入 UI
 *
 * 使用 onAuthStateChange 監聽 session 變化，
 * 確保登入 / 登出後 UI 自動同步更新。
 * 元件卸載時自動取消訂閱，避免 memory leak。
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, hasSupabase } from '../services/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    // 若未設定 Supabase，直接設為非載入狀態，隱藏登入功能
    if (!hasSupabase) {
      setState({ user: null, loading: false });
      return;
    }

    // 取得現有 session（頁面重整後恢復登入狀態）
    supabase.auth.getSession().then(({ data }) => {
      setState({ user: data.session?.user ?? null, loading: false });
    });

    // 監聽登入、登出、token 更新等 auth 事件
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, loading: false });
    });

    // 元件卸載時取消監聽
    return () => subscription.unsubscribe();
  }, []);

  /** 以 Email + 密碼建立新帳號 */
  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  /** 以 Email + 密碼登入 */
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  /** 登出目前使用者 */
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return { ...state, signUp, signIn, signOut, hasSupabase };
}
