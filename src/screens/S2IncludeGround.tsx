// S2 是否拍脚（仅全身）。PRD §4.3：一个问题、两个大按钮、底部下一步。

import { SCREEN_COPY } from '../copy';

interface Props {
  includeGround: boolean;
  onChange: (includeGround: boolean) => void;
  onNext: () => void;
}

export default function S2IncludeGround({ includeGround, onChange, onNext }: Props) {
  return (
    <div className="screen">
      <h1 className="h1">{SCREEN_COPY.s2Title}</h1>
      <div className="choices">
        <button
          className={`choice${includeGround ? ' choice--on' : ''}`}
          aria-pressed={includeGround}
          onClick={() => onChange(true)}
        >
          {SCREEN_COPY.s2GroundYes}
        </button>
        <button
          className={`choice${includeGround ? '' : ' choice--on'}`}
          aria-pressed={!includeGround}
          onClick={() => onChange(false)}
        >
          {SCREEN_COPY.s2GroundNo}
        </button>
      </div>
      <p className="hint">{SCREEN_COPY.s2Hint}</p>
      <button className="primary" onClick={onNext}>
        {SCREEN_COPY.next}
      </button>
    </div>
  );
}
