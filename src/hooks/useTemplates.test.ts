// useTemplates 单测：验证 Supabase 失败时降级到默认模板、成功时合并远程模板。
// 规格 TR-9.1、TR-9.2。

import { describe, expect, it, vi } from 'vitest';
import {
  loadTemplates,
  mergeTemplates,
  readTemplateCache,
  templatesFromCache,
  writeTemplateCache,
} from './useTemplates';
import { DEFAULT_TEMPLATES } from '../profiles';
import type { StoredTemplate } from '../types';

/** 构造一个链式 mock supabase client。chain 本身是 thenable（无 signal 时直接 await）。 */
function mockClient(result: { data?: unknown; error?: Error | null }) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    abortSignal: () => Promise.resolve(result),
    then: (res: (v: typeof result) => void) => Promise.resolve(result).then(res),
  };
  return {
    from: () => chain,
  } as unknown as Parameters<typeof loadTemplates>[0];
}

function remoteRow(id: string, sort: number): StoredTemplate {
  return {
    id,
    name: `远程${id}`,
    description: '',
    cover_url: '',
    sort,
    active: true,
    profile_config: {
      base: 'half',
      label: `远程${id}`,
      targetBox: { x: 0.2, y: 0.15, w: 0.6, h: 0.7 },
      tooFarEnter: 0.36,
      tooFarExit: 0.4,
      tooCloseEnter: 0.56,
      tooCloseExit: 0.52,
      faceOffsetEnter: 0.81,
      faceOffsetExit: 0.65,
      headCropEnter: 0.04,
      headCropExit: 0.07,
      headGapEnter: 0.22,
      headGapExit: 0.17,
      briefing: ['a', 'b', 'c'],
    },
  };
}

describe('loadTemplates', () => {
  it('Supabase 返回错误时降级到默认模板（3 项），fallback=true', async () => {
    const client = mockClient({ data: null, error: new Error('boom') });
    const { templates, fallback } = await loadTemplates(client);
    expect(fallback).toBe(true);
    expect(templates).toHaveLength(3);
    expect(templates.map((t) => t.id)).toEqual(DEFAULT_TEMPLATES.map((t) => t.id));
  });

  it('抛出异常时也降级到默认模板', async () => {
    const chain = {
      select: vi.fn(() => {
        throw new Error('network down');
      }),
    };
    const client = { from: vi.fn(() => chain) } as unknown as Parameters<
      typeof loadTemplates
    >[0];
    const { templates, fallback } = await loadTemplates(client);
    expect(fallback).toBe(true);
    expect(templates).toHaveLength(3);
  });

  it('成功返回 1 个远程模板时，列表含 4 项（3 默认 + 1 远程）', async () => {
    const client = mockClient({ data: [remoteRow('custom-1', 10)] });
    const { templates, fallback } = await loadTemplates(client);
    expect(fallback).toBe(false);
    expect(templates).toHaveLength(4);
    expect(templates.map((t) => t.id)).toContain('custom-1');
  });

  it('远程模板与默认模板同 id 时，以远程为准（不重复）', async () => {
    const client = mockClient({ data: [remoteRow('half', 0)] });
    const { templates } = await loadTemplates(client);
    expect(templates).toHaveLength(3); // half 被远程覆盖，其余 2 个默认保留
    const half = templates.find((t) => t.id === 'half');
    expect(half?.name).toBe('远程half');
  });
});

describe('mergeTemplates', () => {
  it('按 sort 升序排列', () => {
    const remote = [{ ...DEFAULT_TEMPLATES[0], sort: 100 }];
    const merged = mergeTemplates(remote);
    expect(merged[merged.length - 1].id).toBe(DEFAULT_TEMPLATES[0].id);
  });

  it('covers 覆盖固定模板的封面', () => {
    const merged = mergeTemplates([], { half: 'https://x/half.jpg' });
    expect(merged.find((t) => t.id === 'half')?.coverUrl).toBe('https://x/half.jpg');
  });
});

describe('本地快照缓存', () => {
  it('成功拉取时返回缓存快照，失败时为 null', async () => {
    const ok = await loadTemplates(mockClient({ data: [remoteRow('custom-1', 10)] }));
    expect(ok.cache?.remote).toHaveLength(1);
    const bad = await loadTemplates(mockClient({ data: null, error: new Error('boom') }));
    expect(bad.cache).toBeNull();
  });

  it('写入后可读回，并合并默认模板', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });

    writeTemplateCache({ remote: [remoteRow('custom-2', 5)], covers: {} });
    const cache = readTemplateCache();
    expect(cache).not.toBeNull();
    const cached = templatesFromCache(cache);
    expect(cached).toHaveLength(4);
    expect(cached.map((t) => t.id)).toContain('custom-2');

    vi.unstubAllGlobals();
  });

  it('兼容旧格式（纯远程行数组）', () => {
    const store = new Map<string, string>([
      ['shot-guide:templates:v1', JSON.stringify([remoteRow('legacy-1', 5)])],
    ]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });

    const cache = readTemplateCache();
    expect(cache?.remote).toHaveLength(1);
    expect(cache?.covers).toEqual({});

    vi.unstubAllGlobals();
  });

  it('内容损坏时静默返回 null', () => {
    const store = new Map<string, string>([['shot-guide:templates:v1', '{oops']]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });

    expect(readTemplateCache()).toBeNull();
    vi.unstubAllGlobals();
  });
});
