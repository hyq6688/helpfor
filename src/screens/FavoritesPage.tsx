// 我的收藏：按收藏顺序展示模板，空态复用统一 EmptyState。
// 收藏数据来自 useFavorites（本机优先，登录后云端同步）。

import { useState } from 'react';
import TemplateCover from '../components/TemplateCover';
import TemplateDetailSheet from '../components/TemplateDetailSheet';
import { EmptyState } from '../components/StateFeedback';
import { SCREEN_COPY, UI_COPY } from '../copy';
import type { Template } from '../types';

interface Props {
  templates: Template[];
  favoriteIds: string[];
  onSelect: (template: Template) => void;
  onToggleFavorite: (templateId: string) => void;
  onBack: () => void;
  onBrowseAll: () => void;
  /** 已登录但云端不可用：提示收藏只在本机。 */
  localOnlyNote?: boolean;
}

export default function FavoritesPage({
  templates,
  favoriteIds,
  onSelect,
  onToggleFavorite,
  onBack,
  onBrowseAll,
  localOnlyNote,
}: Props) {
  const [detail, setDetail] = useState<Template | null>(null);
  const favoriteSet = new Set(favoriteIds);
  // 按收藏顺序（最近收藏在前），已下架或不存在的模板自动跳过
  const favorites = favoriteIds
    .map((id) => templates.find((template) => template.id === id))
    .filter((template): template is Template => Boolean(template));

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
          <h1 className="wf-pagehead__h1">{UI_COPY.favoritesEntry}</h1>
          <span className="wf-pagehead__count">共 {favorites.length} 个</span>
        </div>
      </div>

      {localOnlyNote && <p className="wf-note wf-note--warn">{UI_COPY.favoritesLocalOnly}</p>}

      {favorites.length === 0 ? (
        <div className="wf-favorites-empty">
          <EmptyState
            title={UI_COPY.favoritesEmptyTitle}
            text={UI_COPY.favoritesEmptyText}
            actionLabel={UI_COPY.allTemplates}
            onAction={onBrowseAll}
          />
        </div>
      ) : (
        <div className="wf-grid wf-favorites-grid">
          {favorites.map((tpl) => (
            <button
              key={tpl.id}
              className="wf-card"
              onClick={() => setDetail(tpl)}
              aria-label={tpl.name}
            >
              <TemplateCover url={tpl.coverUrl} name={tpl.name} />
              <span className="wf-card__fav" aria-hidden="true">
                ♥
              </span>
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
          onClose={() => setDetail(null)}
          onStart={(template) => {
            setDetail(null);
            onSelect(template);
          }}
        />
      )}
    </div>
  );
}
