// 模板加载 hook：Supabase + 3s 超时 + 降级到内置默认模板。
// 规格 AC-9、AC-10。

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { DEFAULT_TEMPLATES, buildProfileFromStored } from '../profiles';
import type { StoredTemplate, Template } from '../types';

const FETCH_TIMEOUT_MS = 3000;

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

/**
 * 拉取启用模板的纯逻辑（可单测）。
 * 失败/超时/错误 → 返回默认模板并标记 fallback。
 */
export async function loadTemplates(
  client: SupabaseClient,
  signal?: AbortSignal,
): Promise<{ templates: Template[]; fallback: boolean }> {
  try {
    let query = client
      .from('templates')
      .select('*')
      .eq('active', true)
      .order('sort', { ascending: true });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;

    if (error || !data) {
      return { templates: DEFAULT_TEMPLATES, fallback: true };
    }

    const remote = (data as unknown as StoredTemplate[]).map(mapStoredToTemplate);
    return { templates: mergeTemplates(remote), fallback: false };
  } catch {
    return { templates: DEFAULT_TEMPLATES, fallback: true };
  }
}

/**
 * React hook：拉取启用的模板；失败/超时 → 返回默认模板并标记 fallback。
 */
export function useTemplates(): { templates: Template[]; loading: boolean; fallback: boolean } {
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    loadTemplates(supabase, controller.signal)
      .then(({ templates: next, fallback: fb }) => {
        if (cancelled) return;
        setTemplates(next);
        setFallback(fb);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  return { templates, loading, fallback };
}
