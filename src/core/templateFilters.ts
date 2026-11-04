// 模板分类 / 排序 / 搜索的纯函数。
// 分类由 profile.base（ProfileConfig.id）本地派生，不依赖数据库新增字段。

import type { Template } from '../types';

export type TemplateCategory = 'all' | 'half' | 'full_ground' | 'full_noground' | 'mine';
export type TemplateSort = 'recommended' | 'latest';

/** 固定模板（三个内置构图骨架）；其余视为管理员创建的「我的模板」。 */
export const FIXED_TEMPLATE_IDS = ['half', 'full_ground', 'full_noground'] as const;

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  all: '全部',
  half: '半身',
  full_ground: '全身拍脚',
  full_noground: '全身不拍脚',
  mine: '我的模板',
};

export const SORT_LABELS: Record<TemplateSort, string> = {
  recommended: '推荐',
  latest: '最新',
};

/** 构图骨架的中文名，详情弹层与管理页共用。 */
export const BASE_LABELS: Record<Template['profile']['id'], string> = {
  half: '半身',
  full_ground: '全身·拍脚',
  full_noground: '全身·不拍脚',
};

export function isMineTemplate(template: Template): boolean {
  return !(FIXED_TEMPLATE_IDS as readonly string[]).includes(template.id);
}

/** 分类过滤。'all' 不过滤；'mine' 取固定模板之外的全部。 */
export function filterByCategory(templates: Template[], category: TemplateCategory): Template[] {
  if (category === 'all') return templates;
  if (category === 'mine') return templates.filter(isMineTemplate);
  return templates.filter((template) => template.profile.id === category);
}

/** 关键词匹配名称与描述，大小写不敏感。 */
export function filterByQuery(templates: Template[], query: string): Template[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return templates;
  return templates.filter(
    (template) =>
      template.name.toLowerCase().includes(keyword) ||
      (template.description ?? '').toLowerCase().includes(keyword),
  );
}

function updatedTime(template: Template): number {
  if (!template.updatedAt) return Number.NaN;
  const time = Date.parse(template.updatedAt);
  return Number.isFinite(time) ? time : Number.NaN;
}

/**
 * 最新排序：有更新时间的按时间倒序；没有时间的沿用 sort 顺序排在后面，
 * 避免内置模板因为缺字段被随机打乱。
 */
export function sortTemplates(templates: Template[], sort: TemplateSort): Template[] {
  const next = [...templates];
  if (sort === 'recommended') {
    return next.sort((a, b) => a.sort - b.sort);
  }
  return next.sort((a, b) => {
    const aTime = updatedTime(a);
    const bTime = updatedTime(b);
    const aHas = Number.isFinite(aTime);
    const bHas = Number.isFinite(bTime);
    if (aHas && bHas) return bTime - aTime || a.sort - b.sort;
    if (aHas) return -1;
    if (bHas) return 1;
    return a.sort - b.sort;
  });
}

export interface TemplateFilters {
  category: TemplateCategory;
  query: string;
  sort: TemplateSort;
}

/** 搜索、分类、排序可组合；顺序固定为「分类 → 搜索 → 排序」。 */
export function applyTemplateFilters(
  templates: Template[],
  filters: TemplateFilters,
): Template[] {
  return sortTemplates(
    filterByQuery(filterByCategory(templates, filters.category), filters.query),
    filters.sort,
  );
}

/** 详情弹层标签：由模板信息本地派生，不依赖 tags 字段。 */
export function templateTags(template: Template): string[] {
  return [BASE_LABELS[template.profile.id] ?? '构图模板', '实时提示', '照片不上传'];
}
