// 模板分类 / 排序 / 搜索纯函数的单元测试。

import { describe, expect, it } from 'vitest';
import {
  applyTemplateFilters,
  filterByCategory,
  filterByQuery,
  sortTemplates,
  templateTags,
} from './templateFilters';
import { DEFAULT_TEMPLATES } from '../profiles';
import type { Template } from '../types';

function tpl(
  id: string,
  name: string,
  description: string,
  sort: number,
  profileIndex: number,
  updatedAt?: string,
): Template {
  return {
    id,
    name,
    description,
    coverUrl: '',
    profile: DEFAULT_TEMPLATES[profileIndex].profile,
    sort,
    active: true,
    updatedAt,
  };
}

const half = tpl('half', '半身照', '胸口以上', 0, 0);
const ground = tpl('full_ground', '全身照（拍脚）', '从头到脚', 1, 1);
const noGround = tpl('full_noground', '全身照（不拍脚）', '拍到小腿', 2, 2);
const customA = tpl('custom-a', '咖啡馆坐姿', '窗边自然光', 3, 0, '2026-10-01T10:00:00Z');
const customB = tpl('custom-b', '街拍回头', '街景逆光', 4, 2, '2026-11-01T10:00:00Z');
const all = [half, ground, noGround, customA, customB];

describe('filterByCategory', () => {
  it('all 返回全部', () => {
    expect(filterByCategory(all, 'all')).toHaveLength(5);
  });

  it('按 profile.base 派生半身 / 全身拍脚 / 全身不拍脚', () => {
    expect(filterByCategory(all, 'half').map((t) => t.id)).toEqual(['half', 'custom-a']);
    expect(filterByCategory(all, 'full_ground').map((t) => t.id)).toEqual(['full_ground']);
    expect(filterByCategory(all, 'full_noground').map((t) => t.id)).toEqual([
      'full_noground',
      'custom-b',
    ]);
  });

  it('我的模板只包含管理员创建的非固定模板', () => {
    expect(filterByCategory(all, 'mine').map((t) => t.id)).toEqual(['custom-a', 'custom-b']);
  });
});

describe('filterByQuery', () => {
  it('匹配名称与描述，忽略大小写与首尾空格', () => {
    expect(filterByQuery(all, ' 半身 ').map((t) => t.id)).toEqual(['half']);
    expect(filterByQuery(all, '窗边').map((t) => t.id)).toEqual(['custom-a']);
    expect(filterByQuery(all, '')).toHaveLength(5);
  });
});

describe('sortTemplates', () => {
  it('推荐排序按 sort 升序', () => {
    const shuffled = [customB, ground, customA, half, noGround];
    expect(sortTemplates(shuffled, 'recommended').map((t) => t.id)).toEqual([
      'half',
      'full_ground',
      'full_noground',
      'custom-a',
      'custom-b',
    ]);
  });

  it('最新排序按 updatedAt 倒序，缺时间的模板按 sort 排在后面', () => {
    expect(sortTemplates(all, 'latest').map((t) => t.id)).toEqual([
      'custom-b',
      'custom-a',
      'half',
      'full_ground',
      'full_noground',
    ]);
  });

  it('非法时间视为缺失，不会抛错', () => {
    const broken = { ...customA, updatedAt: 'not-a-date' };
    expect(() => sortTemplates([broken, half], 'latest')).not.toThrow();
  });
});

describe('applyTemplateFilters', () => {
  it('分类、搜索、排序可组合', () => {
    const result = applyTemplateFilters(all, {
      category: 'mine',
      query: '街',
      sort: 'latest',
    });
    expect(result.map((t) => t.id)).toEqual(['custom-b']);
  });

  it('无匹配时返回空数组，供空态使用', () => {
    expect(
      applyTemplateFilters(all, { category: 'half', query: '海边', sort: 'recommended' }),
    ).toEqual([]);
  });
});

describe('templateTags', () => {
  it('标签由分类派生且不重复', () => {
    const tags = templateTags(customA);
    expect(tags[0]).toBe('半身');
    expect(new Set(tags).size).toBe(tags.length);
  });
});
