// S1 首页：品牌头 + 四宫格（三个固定模板 + 全部模板入口）。
// 桌面 ≥1024 额外展示编辑式 hero 与 4 个功能点；相机流程不在此页。

import { useState } from 'react';
import BrandMark from '../components/BrandMark';
import TemplateCover from '../components/TemplateCover';
import TemplateDetailSheet from '../components/TemplateDetailSheet';
import { BRAND_COPY, UI_COPY, templatesCountText } from '../copy';
import { DEFAULT_TEMPLATES } from '../profiles';
import type { Template } from '../types';

/** 首页固定展示的三个模板 id（与 DEFAULT_TEMPLATES 一致）。 */
const FIXED_IDS = ['half', 'full_ground', 'full_noground'] as const;

interface Props {
  templates: Template[];
  fallback: boolean;
  onSelect: (template: Template) => void;
  onOpenAll: () => void;
  favoriteIds: string[];
  onToggleFavorite: (templateId: string) => void;
}

/** 「全部模板」卡片里的九宫格图标。 */
function AllIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="tpl-all__icon">
      <g fill="currentColor" opacity="0.55">
        <rect x="6" y="6" width="15" height="15" rx="4" />
        <rect x="27" y="6" width="15" height="15" rx="4" />
        <rect x="6" y="27" width="15" height="15" rx="4" />
        <rect x="27" y="27" width="15" height="15" rx="4" />
      </g>
    </svg>
  );
}

export default function S1TemplateList({
  templates,
  fallback,
  onSelect,
  onOpenAll,
  favoriteIds,
  onToggleFavorite,
}: Props) {
  const [detail, setDetail] = useState<Template | null>(null);
  const favoriteSet = new Set(favoriteIds);
  const fixed = FIXED_IDS.map(
    (id) => templates.find((t) => t.id === id) ?? DEFAULT_TEMPLATES.find((t) => t.id === id),
  ).filter((t): t is Template => Boolean(t));

  return (
    <div className="wf-page wf-home">
      <header className="wf-home__head">
        <div className="wf-home__brandline">
          <BrandMark compact />
          <span className="wf-eyebrow">{BRAND_COPY.kicker}</span>
        </div>
        <h1 className="wf-home__title">{BRAND_COPY.homeTitle}</h1>
        <p className="wf-home__sub">{BRAND_COPY.homeSubtitle}</p>
      </header>

      {fallback && <p className="wf-note wf-note--warn">{UI_COPY.templatesFallback}</p>}

      <div className="wf-home__layout">
        <section className="wf-home__hero">
          <p className="wf-eyebrow">{BRAND_COPY.kicker}</p>
          <h2 className="wf-home__hero-title">{BRAND_COPY.homeHeroTitle}</h2>
          <p className="wf-home__hero-body">{BRAND_COPY.homeHeroBody}</p>
          <ul className="wf-features">
            {BRAND_COPY.homeFeatures.map((item) => (
              <li key={item.title} className="wf-feature">
                <span className="wf-feature__dot" aria-hidden="true" />
                <span>
                  <span className="wf-feature__title">{item.title}</span>
                  <span className="wf-feature__desc">{item.desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="wf-tpl-fixed">
          {fixed.map((tpl) => (
            <button
              key={tpl.id}
              className="wf-card"
              onClick={() => setDetail(tpl)}
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

          <button
            className="wf-card wf-card--all"
            onClick={onOpenAll}
            aria-label={UI_COPY.allTemplates}
          >
            <div className="wf-card__allcover">
              <span className="wf-card__badge">{templates.length}</span>
              <AllIcon />
            </div>
            <div className="wf-card__body">
              <p className="wf-card__name">{UI_COPY.allTemplates}</p>
              <p className="wf-card__desc">{templatesCountText(templates.length)}</p>
            </div>
          </button>
        </div>
      </div>

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
