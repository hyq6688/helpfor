// 模板加载 hook：首屏立即渲染（本地缓存或内置默认），后台再拉远程。
// 规格 AC-9、AC-10。

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { DEFAULT_TEMPLATES, buildProfileFromStored } from '../profiles';
import type { StoredTemplate, Template } from '../types';

// 移动网络/代理下 Supabase 首请求（含 TLS 握手）常超 3s，给到 10s。
const FETCH_TIMEOUT_MS = 10000;
// 远程模板快照：命中后首屏直接渲染真实模板，无需等网络。
const CACHE_KEY = 'shot-guide:templates:v1';

export function mapStoredToTemplate(row: StoredTemplate): Template {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    coverUrl: row.cover_url ?? '',
    profile: buildProfileFromStored(row.profile_config),
    sort: row.sort ?? 0,
    active: row.active ?? true,
  };
}

/**
 * 合并远程模板与默认模板：同 id 以远程为准，其余默认模板保留兜底。
 */
export function mergeTemplates(remote: Template[]): Template[] {
  const remoteById = new Map(remote.map((t) => [t.id, t]));
  return [...DEFAULT_TEMPLATES.filter((t) => !remoteById.has(t.id)), ...remote].sort(
    (a, b) => a.sort - b.sort,
  );
}

export interface LoadResult {
  templates: Template[];
  fallback: boolean;
  /** 远程原始行，供写入本地缓存；降级时为 null。 */
  rows: StoredTemplate[] | null;
}

/**
 * 拉取启用模板的纯逻辑（可单测）。
 * 失败/超时/错误 → 返回默认模板并标记 fallback。
 */
export async function loadTemplates(
  client: SupabaseClient,
  signal?: AbortSignal,
): Promise<LoadResult> {
  try {
    let query = client
      .from('templates')
      .select('*')
      .eq('active', true)
      .order('sort', { ascending: true });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;

    if (error || !data) {
      return { templates: DEFAULT_TEMPLATES, fallback: true, rows: null };
    }

    const rows = data as unknown as StoredTemplate[];
    const remote = rows.map(mapStoredToTemplate);
    return { templates: mergeTemplates(remote), fallback: false, rows };
  } catch {
    return { templates: DEFAULT_TEMPLATES, fallback: true, rows: null };
  }
}

/** 读本地快照；无缓存、内容不合法或环境不支持 → null。 */
export function readTemplateCache(): Template[] | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const rows = JSON.parse(raw) as StoredTemplate[];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return mergeTemplates(rows.map(mapStoredToTemplate));
  } catch {
    return null;
  }
}

/** 写本地快照；隐私模式/配额不足时静默失败，只失去下次首屏秒出。 */
export function writeTemplateCache(rows: StoredTemplate[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  } catch {
    // 忽略即可
  }
}

/**
 * React hook：立即返回可渲染的模板（缓存或默认），远程结果到达后就地替换。
 * 不再用 loading 门禁首屏，失败时只置 fallback 提示。
 */
export function useTemplates(): { templates: Template[]; fallback: boolean } {
  const [templates, setTemplates] = useState<Template[]>(
    () => readTemplateCache() ?? DEFAULT_TEMPLATES,
  );
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    // 未配置 Supabase（本地/离线）时不发请求，直接展示默认模板
    if (!isSupabaseConfigured()) return;

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    loadTemplates(supabase, controller.signal)
      .then((result) => {
        if (cancelled) return;
        setTemplates(result.templates);
        setFallback(result.fallback);
        if (result.rows) writeTemplateCache(result.rows);
      })
      .catch(() => {
        if (!cancelled) setFallback(true);
      })
      .finally(() => window.clearTimeout(timeoutId));

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  return { templates, fallback };
}
