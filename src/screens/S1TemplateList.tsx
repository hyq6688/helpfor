// S1 模板列表。规格 §2.2、AC-7~AC-9。
// 从 useTemplates 拉取模板（含 Supabase 远程 + 内置兜底），点卡片 → 选模板进 S3。

import { useTemplates } from '../hooks/useTemplates';
import { UI_COPY } from '../copy';
import type { Template } from '../types';

interface Props {
  onSelect: (template: Template) => void;
}

/** 封面图加载失败时显示轮廓占位。 */
function CoverPlaceholder() {
  return (
    <svg viewBox="0 0 100 140" aria-hidden="true" style={{ width: '100%', height: '100%' }}>
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.35">
        <circle cx="50" cy="38" r="16" />
        <path d="M22 130 Q22 92 50 90 Q78 92 78 130" />
      </g>
    </svg>
  );
}

export default function S1TemplateList({ onSelect }: Props) {
  const { templates, loading, fallback } = useTemplates();

  return (
    <div className="screen">
      <h1 className="h1">{UI_COPY.templatesLoading ? '选择模板' : '选择模板'}</h1>
      {fallback && <p className="tpl-fallback">{UI_COPY.templatesFallback}</p>}
      {loading ? (
        <p className="small" style={{ textAlign: 'center' }}>
          {UI_COPY.templatesLoading}
        </p>
      ) : (
        <div className="tpl-grid">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              className="tpl-card"
              onClick={() => onSelect(tpl)}
              aria-label={tpl.name}
            >
              <div className="tpl-card__cover" style={{ color: 'var(--text-muted)' }}>
                {tpl.coverUrl ? (
                  <img
                    src={tpl.coverUrl}
                    alt={tpl.name}
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <CoverPlaceholder />
                )}
              </div>
              <div className="tpl-card__body">
                <p className="tpl-card__name">{tpl.name}</p>
                <p className="tpl-card__desc">{tpl.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
