// 单行提示条。SPEC §9.1：90vw、圆角 16px、28px 粗体；颜色是唯一的状态语言。

import type { RuleColor } from '../types';

export default function GuideBar({ color, text }: { color: RuleColor; text: string }) {
  return (
    <div className={`guidebar guidebar--${color}`}>
      <span className="guidebar__text">{text}</span>
    </div>
  );
}
