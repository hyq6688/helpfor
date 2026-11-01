// Supabase 浏览器端单例。只使用 anon key，绝不在此处出现 service_role。
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // 配置缺失时不崩：返回一个会抛错的占位 client，
  // 由各调用点的 try/catch 降级（模板走内置兜底，登录功能不可用）。
  console.warn('[supabase] 未配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，登录与模板云同步不可用');
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}
