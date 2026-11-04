// 浏览层外壳：侧栏 + 顶栏 + 独立滚动的内容区。
// 只包裹 S1 / 全部模板 / 模板管理；相机屏幕保持全屏、不进入 shell。

import { useState, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export type BrowseScreen = 'S1' | 'AllTemplates' | 'Favorites' | 'Admin' | 'Account';

const TITLES: Record<BrowseScreen, string> = {
  S1: '首页',
  AllTemplates: '全部模板',
  Favorites: '我的收藏',
  Admin: '模板管理',
  Account: '账号',
};

interface Props {
  active: BrowseScreen;
  onNavigate: (screen: BrowseScreen) => void;
  isAdminUser: boolean;
  accountInitial: string | null;
  onOpenAccount: () => void;
  authSlot?: ReactNode;
  children: ReactNode;
}

export default function AppShell({
  active,
  onNavigate,
  isAdminUser,
  accountInitial,
  onOpenAccount,
  authSlot,
  children,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`wf-shell${collapsed ? ' wf-shell--collapsed' : ''}`}>
      <Sidebar
        active={active}
        onNavigate={onNavigate}
        isAdminUser={isAdminUser}
        accountInitial={accountInitial}
        onOpenAccount={onOpenAccount}
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
      />
      <div className="wf-shell__body">
        <Topbar title={TITLES[active]} authSlot={authSlot} />
        <main className="wf-main">
          <div className="wf-container">{children}</div>
        </main>
      </div>
    </div>
  );
}
