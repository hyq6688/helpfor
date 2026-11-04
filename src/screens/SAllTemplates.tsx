// 「全部模板」页：下划线分类 Tab + 排序胶囊 + 搜索，三者可组合过滤。
// 分类由 profile.base 本地派生；「我的模板」= 固定模板之外的管理员模板。
// 点击卡片打开详情弹层，不再直接进入相机。

import { useEffect, useMemo, useState } from 'react';
import TemplateCover from '../components/TemplateCover';
import TemplateDetailSheet from '../components/TemplateDetailSheet';
import { EmptyState, ErrorNotice } from '../components/StateFeedback';
import {
  CATEGORY_LABELS,
  SORT_LABELS,
  applyTemplateFilters,
} from '../core/templateFilters';
import type { TemplateCategory, TemplateSort } from '../core/templateFilters';
import { BRAND_COPY, SCREEN_COPY, UI_COPY } from '../copy';
import type { Template } from '../types';

interface Props {
  templates: Template[];
  fallback: boolean;
  onSelect: (template: Template) => void;
  onBack: () => void;
  favoriteIds: string[];
  onToggleFavorite: (templateId: string) => void;
  /** 深链模板 id（#/templates/:id）；变化时自动打开对应详情。 */
  deepLinkId?: string | null;
  onDetailRouteChange?: (templateId: string | null) => void;
}

const CATEGORIES: TemplateCategory[] = ['all', 'half', 'full_ground', 'full_noground', 'mine'];
// 「使用最多」需要次数统计，当前没有该字段，按约定直接不展示
const SORTS: TemplateSort[] = ['recommended', 'latest'];

export default function SAllTemplates({
  templates,
  fallback,
  onSelect,
  onBack,
  favoriteIds,
  onToggleFavorite,
  deepLinkId,
  onDetailRouteChange,
}: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('all');
  const [sort, setSort] = useState<TemplateSort>('recommended');
  const [detail, setDetail] = useState<Template | null>(null);
  const favoriteSet = new Set(favoriteIds);

  const filtered = useMemo(
    () => applyTemplateFilters(templates, { category, query, sort }),
    [templates, category, query, sort],
  );

  const isFiltering = query.trim() !== '' || category !== 'all';
  const hasFilters = query.trim() !== '' || category !== 'all' || sort !== 'recommended';

  const clearFilters = () => {
    setQuery('');
    setCategory('all');
    setSort('recommended');
  };

  // 深链：URL 带模板 id 时自动打开详情；URL 回到 #/templates 时同步关闭
  useEffect(() => {
    if (deepLinkId) {
      const found = templates.find((template) => template.id === deepLinkId);
      if (found) setDetail(found);
      return;
    }
    if (detail) setDetail(null);
  }, [deepLinkId, templates, detail]);

  const openDetail = (template: Template) => {
    setDetail(template);
    onDetailRouteChange?.(template.id);
  };

  const closeDetail = () => {
    setDetail(null);
    onDetailRouteChange?.(null);
  };

  return (
    <div className="wf-page wf-all">
      <div className="wf-pagehead">
        <button className="btn btn--ghost wf-back" onClick={onBack}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M12.5 4 6.5 10l6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {SCREEN_COPY.back}
        </button>
        <div className="wf-pagehead__title">
          <h1 className="wf-pagehead__h1">{UI_COPY.allTemplates}</h1>
          <span className="wf-pagehead__count">
            {isFiltering ? `筛选出 ${filtered.length} 个` : `共 ${templates.length} 个`}
          </span>
        </div>
      </div>

      <div className="wf-toolbar">
        <div className="wf-search">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="9" cy="9" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="m13 13 4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={BRAND_COPY.allTemplatesSearch}
            aria-label={BRAND_COPY.allTemplatesSearch}
          />
        </div>

        <div className="wf-sort" role="group" aria-label="排序">
          {SORTS.map((item) => (
            <button
              key={item}
              className={`wf-pill${sort === item ? ' wf-pill--on' : ''}`}
              aria-pressed={sort === item}
              onClick={() => setSort(item)}
            >
              {SORT_LABELS[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="wf-tabbar" role="tablist" aria-label="模板分类">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={category === item}
            className={`wf-tab${category === item ? ' wf-tab--on' : ''}`}
            onClick={() => setCategory(item)}
          >
            {CATEGORY_LABELS[item]}
          </button>
        ))}
      </div>

      {fallback && <ErrorNotice message={UI_COPY.templatesFallback} />}

      {filtered.length === 0 ? (
        <EmptyState
          title={BRAND_COPY.emptyTitle}
          text={templates.length === 0 ? BRAND_COPY.emptyNone : BRAND_COPY.emptySearch}
          actionLabel={hasFilters ? UI_COPY.clearFilters : undefined}
          onAction={hasFilters ? clearFilters : undefined}
        />
      ) : (
        <div className="wf-grid">
          {filtered.map((tpl) => (
            <button
              key={tpl.id}
              className="wf-card"
              onClick={() => openDetail(tpl)}
              aria-label={tpl.name}
            >
              <TemplateCover url={tpl.coverUrl} name={tpl.name} />
              {favoriteSet.has(tpl.id) && (
                <span className="wf-card__fav" aria-hidden="true">
                  ♥
                </span>
              )}
              <div className="wf-card__body">
                <p className="wf-card__name">{tpl.name}</p>
                {tpl.description && <p className="wf-card__desc">{tpl.description}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <TemplateDetailSheet
          template={detail}
          favorited={favoriteSet.has(detail.id)}
          onToggleFavorite={onToggleFavorite}
          onClose={closeDetail}
          onStart={(template) => {
            setDetail(null);
            onSelect(template);
          }}
        />
      )}
    </div>
  );
}
