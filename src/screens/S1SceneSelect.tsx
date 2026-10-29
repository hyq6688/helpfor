// S1 场景选择。PRD §4.3：两张竖排大卡，各占约 40% 高度；无其他元素。

import { SCREEN_COPY } from '../copy';
import type { SceneId } from '../types';

function CardArt({ kind }: { kind: 'half' | 'full' }) {
  return (
    <svg className="card__art" viewBox="0 0 100 160" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
        <circle cx="50" cy={kind === 'half' ? 56 : 28} r={kind === 'half' ? 18 : 13} />
        {kind === 'half' ? (
          <path d="M18 158 Q18 110 50 108 Q82 110 82 158" />
        ) : (
          <>
            <path d="M50 41 V92" />
            <path d="M30 62 L70 62" />
            <path d="M50 92 L34 156" />
            <path d="M50 92 L66 156" />
          </>
        )}
      </g>
    </svg>
  );
}

export default function S1SceneSelect({ onSelect }: { onSelect: (sceneId: SceneId) => void }) {
  return (
    <div className="screen">
      <h1 className="h1">{SCREEN_COPY.s1Title}</h1>
      <div className="cards">
        <button className="card" onClick={() => onSelect('half')}>
          <CardArt kind="half" />
          <span className="card__label">{SCREEN_COPY.s1Half}</span>
        </button>
        <button className="card" onClick={() => onSelect('full')}>
          <CardArt kind="full" />
          <span className="card__label">{SCREEN_COPY.s1Full}</span>
        </button>
      </div>
    </div>
  );
}
