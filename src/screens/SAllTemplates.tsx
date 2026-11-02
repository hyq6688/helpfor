// 「全部模板」页：列出所有模板（3 个固定模板 + 管理员新增），点击进 S3。
// 规格 §2.2。

import TemplateCover from '../components/TemplateCover';
import { SCREEN_COPY, UI_COPY } from '../copy';
import type { Template } from '../types';

interface Props {
  templates: Template[];
  onSelect: (template: Template) => void;
  onBack: () => void;
}

export default function SAllTemplates({ templates, onSelect, onBack }: Props) {
  return (
    <div className="screen">
      <div className="all-head">
        <button className="btn btn--ghost" onClick={onBack}>
          {SCREEN_COPY.back}
        </button>
        <h1 className="h1">{UI_COPY.allTemplates}</h1>
      </div>

      <div className="tpl-grid">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            className="tpl-card"
            onClick={() => onSelect(tpl)}
            aria-label={tpl.name}
          >
            <TemplateCover url={tpl.coverUrl} name={tpl.name} />
            <div className="tpl-card__body">
              <p className="tpl-card__name">{tpl.name}</p>
              {tpl.description && <p className="tpl-card__desc">{tpl.description}</p>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
