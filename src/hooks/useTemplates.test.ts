// useTemplates 单测：验证 Supabase 失败时降级到默认模板、成功时合并远程模板。
// 规格 TR-9.1、TR-9.2。

import { describe, expect, it, vi } from 'vitest';
import { loadTemplates, mergeTemplates } from './useTemplates';
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
});
