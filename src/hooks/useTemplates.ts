// 模板加载 hook：首屏立即渲染（本地缓存或内置默认），后台再拉远程。
// 远程包含两路数据：模板行（templates）+ 固定模板封面覆盖（template_covers）。
// 规格 AC-9、AC-10。

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { DEFAULT_TEMPLATES, buildProfileFromStored } from '../profiles';
import type { StoredTemplate, Template, TemplateCoverRow } from '../types';

// 移动网络/代理下 Supabase 首请求（含 TLS 握手）常超 3s，给到 10s。
const FETCH_TIMEOUT_MS = 10000;
// 远程快照：命中后首屏直接渲染真实模板与封面，无需等网络。
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
    updatedAt: row.updated_at,
  };
}

/** 把 template_covers 行转成 key → url 映射；无效行忽略。 */
export function mapCovers(rows: TemplateCoverRow[] | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!rows) return out;
  for (const row of rows) {
    if (row && typeof row.key === 'string' && row.key && row.cover_url) {
      out[row.key] = row.cover_url;
    }
  }
  return out;
}

/**
 * 合并远程模板与默认模板：同 id 以远程为准，其余默认模板保留兜底。
 * covers 用于覆盖三个固定模板的封面（管理员在管理页替换）。
 */
export function mergeTemplates(
  remote: Template[],
  covers: Record<string, string> = {},
): Template[] {
  const defaults = DEFAULT_TEMPLATES.map((t) =>
    covers[t.id] ? { ...t, coverUrl: covers[t.id] } : t,
  );
  const remoteById = new Map(remote.map((t) => [t.id, t]));
  return [...defaults.filter((t) => !remoteById.has(t.id)), ...remote].sort(
    (a, b) => a.sort - b.sort,
  );
}

/** 本地快照内容：远程模板行 + 固定模板封面覆盖。 */
export interface TemplateCache {
  remote: StoredTemplate[];
  covers: Record<string, string>;
}

export interface LoadResult {
  templates: Template[];
  fallback: boolean;
  /** 供写入本地缓存；降级时为 null。 */
  cache: TemplateCache | null;
}

async function queryTemplates(client: SupabaseClient, signal?: AbortSignal) {
  let query = client
    .from('templates')
    .select('*')
    .eq('active', true)
    .order('sort', { ascending: true });
  if (signal) query = query.abortSignal(signal);
  return query;
}

async function queryCovers(client: SupabaseClient, signal?: AbortSignal) {
  let query = client.from('template_covers').select('*');
  if (signal) query = query.abortSignal(signal);
  return query;
}

/** 把可能同步抛错或异步拒绝的查询统一转成结果对象，避免单路失败拖垮整体。 */
function safeQuery<T>(run: () => PromiseLike<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  return Promise.resolve()
    .then(run)
    .then((value) => ({ ok: true as const, value }))
    .catch(() => ({ ok: false as const }));
}

/**
 * 拉取启用模板与封面覆盖的纯逻辑（可单测）。
 * 模板拉取失败/超时 → 返回默认模板并标记 fallback；封面失败不影响主列表。
 */
export async function loadTemplates(
  client: SupabaseClient,
  signal?: AbortSignal,
): Promise<LoadResult> {
  const [tplRes, coverRes] = await Promise.all([
    safeQuery(() => queryTemplates(client, signal)),
    safeQuery(() => queryCovers(client, signal)),
  ]);

  if (!tplRes.ok) {
    return { templates: mergeTemplates([]), fallback: true, cache: null };
  }

  const { data, error } = tplRes.value as { data: unknown; error: Error | null };
  if (error || !data) {
    return { templates: mergeTemplates([]), fallback: true, cache: null };
  }

  const remote = data as StoredTemplate[];
  const covers = coverRes.ok
    ? mapCovers((coverRes.value as { data: TemplateCoverRow[] | null }).data)
    : {};

  return {
    templates: mergeTemplates(remote.map(mapStoredToTemplate), covers),
    fallback: false,
    cache: { remote, covers },
  };
}

/** 读本地快照；无缓存、内容不合法或环境不支持 → null。 */
export function readTemplateCache(): TemplateCache | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;

    // 旧格式：直接存远程行数组
    if (Array.isArray(parsed)) {
      const rows = parsed as StoredTemplate[];
      return rows.length ? { remote: rows, covers: {} } : null;
    }

    const obj = parsed as Partial<TemplateCache> | null;
    if (!obj || !Array.isArray(obj.remote)) return null;
    return { remote: obj.remote, covers: obj.covers ?? {} };
  } catch {
    return null;
  }
}

/** 写本地快照；隐私模式/配额不足时静默失败，只失去下次首屏秒出。 */
export function writeTemplateCache(cache: TemplateCache): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 忽略即可
  }
}

/** 缓存 → 可渲染模板；无缓存时用内置默认。 */
export function templatesFromCache(cache: TemplateCache | null): Template[] {
  if (!cache) return mergeTemplates([]);
  return mergeTemplates(cache.remote.map(mapStoredToTemplate), cache.covers);
}

/**
 * React hook：立即返回可渲染的模板（缓存或默认），远程结果到达后就地替换。
 * 不再用 loading 门禁首屏，失败时只置 fallback 提示。
 */
export function useTemplates(): { templates: Template[]; fallback: boolean } {
  const [templates, setTemplates] = useState<Template[]>(() => templatesFromCache(readTemplateCache()));
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
        if (result.cache) writeTemplateCache(result.cache);
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
