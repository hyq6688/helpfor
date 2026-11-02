// S1 模板列表：2×2 四宫格（三个固定模板 + 全部模板入口）。
// 规格 §2.2、AC-7~AC-9。

import TemplateCover from '../components/TemplateCover';
import { UI_COPY, templatesCountText } from '../copy';
import { DEFAULT_TEMPLATES } from '../profiles';
import type { Template } from '../types';

/** 首页固定展示的三个模板 id（与 DEFAULT_TEMPLATES 一致）。 */
const FIXED_IDS = ['half', 'full_ground', 'full_noground'] as const;

interface Props {
  templates: Template[];
  fallback: boolean;
  onSelect: (template: Template) => void;
  onOpenAll: () => void;
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

export default function S1TemplateList({ templates, fallback, onSelect, onOpenAll }: Props) {
  const fixed = FIXED_IDS.map(
    (id) => templates.find((t) => t.id === id) ?? DEFAULT_TEMPLATES.find((t) => t.id === id),
  ).filter((t): t is Template => Boolean(t));

  return (
    <div className="screen">
      <h1 className="h1">选择模板</h1>
      {fallback && <p className="tpl-fallback">{UI_COPY.templatesFallback}</p>}

      <div className="tpl-fixed">
        {fixed.map((tpl) => (
          <button
            key={tpl.id}
            className="tpl-card"
            onClick={() => onSelect(tpl)}
            aria-label={tpl.name}
          >
            <TemplateCover url={tpl.coverUrl} name={tpl.name} />
            <div className="tpl-card__body">
              <p className="tpl-card__name">{tpl.name}</p>
            </div>
          </button>
        ))}

        <button className="tpl-card tpl-all" onClick={onOpenAll} aria-label={UI_COPY.allTemplates}>
          <div className="tpl-all__cover">
            <AllIcon />
          </div>
          <div className="tpl-card__body">
            <p className="tpl-card__name">{UI_COPY.allTemplates}</p>
            <p className="tpl-card__desc">{templatesCountText(templates.length)}</p>
          </div>
        </button>
      </div>
    </div>
  );
}
