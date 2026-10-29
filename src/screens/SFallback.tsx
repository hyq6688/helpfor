// SFallback：相机不可用。PRD §4.3：原因文案 + 纯文字静态简报 + 重试 / 返回首页。

import { FALLBACK_REASON, SCREEN_COPY } from '../copy';
import type { FailureKind } from '../state';

const MARK = ['①', '②', '③'];

interface Props {
  failure: FailureKind;
  briefing: string[];
  onRetry: () => void;
  onHome: () => void;
}

export default function SFallback({ failure, briefing, onRetry, onHome }: Props) {
  return (
    <div className="screen screen--fallback">
      <h1 className="fallback__title">{SCREEN_COPY.sFallbackTitle}</h1>
      <p className="fallback__reason">{FALLBACK_REASON[failure]}</p>

      <ul className="briefing">
        {briefing.map((line, i) => (
          <li key={line}>
            {MARK[i]} {line}
          </li>
        ))}
      </ul>

      <button className="primary" onClick={onRetry}>
        {SCREEN_COPY.retry}
      </button>
      <button className="ghost" onClick={onHome}>
        {SCREEN_COPY.backHome}
      </button>
    </div>
  );
}
