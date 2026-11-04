// 浏览层顶栏：58px，半透明 + backdrop blur 12；右侧放账户入口。
// 相机页不走 AppShell，因此这里不处理安全区顶栏。

import type { ReactNode } from 'react';
import ThemeToggle from './ThemeToggle';

interface Props {
  title: string;
  authSlot?: ReactNode;
}

export default function Topbar({ title, authSlot }: Props) {
  return (
    <header className="wf-topbar">
      <div className="wf-topbar__left">
        <span className="wf-topbar__page">{title}</span>
      </div>
      <div className="wf-topbar__right">
        <ThemeToggle />
        {authSlot}
      </div>
    </header>
  );
}
