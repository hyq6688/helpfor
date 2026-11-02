// 屏幕路由。SPEC §2：App 用 useReducer 管理 AppState，screen 决定渲染哪个屏幕，不使用 URL 路由。

import { lazy, Suspense, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import S1TemplateList from './screens/S1TemplateList';
import S2IncludeGround from './screens/S2IncludeGround';
import S3Handoff from './screens/S3Handoff';
import S5Select from './screens/S5Select';
import SFallback from './screens/SFallback';
import SAllTemplates from './screens/SAllTemplates';
import LoginModal from './screens/LoginModal';
import SetPasswordModal from './screens/SetPasswordModal';
import { useTemplates } from './hooks/useTemplates';
import type { CameraFailureKind } from './hooks/useCamera';
import { PROFILES } from './profiles';
import { initialState, markOnboardingSeen, reducer } from './state';
import type { ScreenId } from './types';
import { isAdmin, useAuth } from './context/AuthContext';
import { UI_COPY } from './copy';

// 大依赖懒加载：S4 会带入 @mediapipe/tasks-vision（首屏包体积的主要来源），
// 手动模式与管理页同样不在首屏路径，一并拆出。
const S4Guide = lazy(() => import('./screens/S4Guide'));
const SManual = lazy(() => import('./screens/SManual'));
const AdminTemplates = lazy(() => import('./screens/AdminTemplates'));

/** 浏览器历史里保存的导航快照；depth 表示当前条目距应用入口的层数。 */
interface NavState {
  app: true;
  screen: ScreenId;
  depth: number;
}

// 阶段 3 尚未接入的屏幕（S5 起在后续阶段实现），仅占位以免流程断在代码里。
function Pending({ screen }: { screen: ScreenId }) {
  return (
    <div className="screen screen--center">
      <p className="small">{screen} 尚未接入</p>
    </div>
  );
}

/** S1 右上角认证入口：未登录显示「登录」，已登录显示邮箱缩写 + 下拉菜单。 */
function AuthEntry({
  onOpenAdmin,
  onOpenSetPassword,
}: {
  onOpenAdmin: () => void;
  onOpenSetPassword: () => void;
}) {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const initial = (user.email ?? '?').charAt(0).toUpperCase();

  return (
    <>
      <button className="auth-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="账户">
        {initial}
      </button>
      {menuOpen && (
        <div className="auth-menu" onMouseLeave={() => setMenuOpen(false)}>
          {isAdmin(user) && (
            <button
              className="auth-menu__item"
              onClick={() => {
                setMenuOpen(false);
                onOpenAdmin();
              }}
            >
              {UI_COPY.adminEntry}
            </button>
          )}
          <button
            className="auth-menu__item"
            onClick={() => {
              setMenuOpen(false);
              onOpenSetPassword();
            }}
          >
            {UI_COPY.setPasswordEntry}
          </button>
          <button
            className="auth-menu__item"
            onClick={() => {
              setMenuOpen(false);
              signOut();
            }}
          >
            {UI_COPY.logout}
          </button>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showLogin, setShowLogin] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  // 优先用模板带的完整 ProfileConfig（自定义阈值），否则回退到 PROFILES
  const profile = state.templateProfile ?? (state.profile ? PROFILES[state.profile] : null);
  const auth = useAuth();
  // 模板在 App 层拉一次，S1 与「全部模板」页共用，避免重复请求
  const { templates, fallback: templatesFallback } = useTemplates();

  // 浏览器返回键同步：每个屏幕入栈一条历史，返回时按历史里的屏幕还原。
  // 到应用入口（首页）之前的历史时不做拦截，按浏览器默认行为离开站点。
  const screenRef = useRef<ScreenId>(state.screen);
  const skipPushRef = useRef(false);

  useEffect(() => {
    window.history.replaceState(
      { app: true, screen: initialState.screen, depth: 0 } satisfies NavState,
      '',
    );

    const onPop = (e: PopStateEvent) => {
      const nav = e.state as NavState | null;
      if (!nav?.app) return;
      // 本次切换由 popstate 驱动，避免 effect 再补一条历史
      skipPushRef.current = true;
      if (nav.screen === 'S1') dispatch({ type: 'BACK_HOME' });
      else dispatch({ type: 'GOTO', screen: nav.screen });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (screenRef.current === state.screen) {
      skipPushRef.current = false;
      return;
    }
    screenRef.current = state.screen;
    if (skipPushRef.current) {
      skipPushRef.current = false;
      return;
    }
    const nav = window.history.state as NavState | null;
    const depth = (nav?.app ? nav.depth : 0) + 1;
    window.history.pushState(
      { app: true, screen: state.screen, depth } satisfies NavState,
      '',
    );
  }, [state.screen]);

  // SPEC §11 第 1 步：非安全连接直接进 SFallback，不尝试调用摄像头
  const startGuide = useCallback(() => {
    if (!window.isSecureContext) {
      dispatch({ type: 'CAMERA_FAILED', failure: 'insecure' });
      return;
    }
    dispatch({ type: 'GOTO', screen: 'S4' });
  }, []);

  const onCameraFailure = useCallback((failure: CameraFailureKind) => {
    dispatch({ type: 'CAMERA_FAILED', failure });
  }, []);

  const onCaptured = useCallback((photos: Blob[]) => {
    dispatch({ type: 'SET_PHOTOS', photos });
    dispatch({ type: 'GOTO', screen: 'S5' });
  }, []);

  // 引导只展示一次：写 localStorage 后再更新状态（SPEC §9.7）
  const onOnboardingSeen = useCallback(() => {
    markOnboardingSeen();
    dispatch({ type: 'SET_ONBOARDING_SEEN' });
  }, []);

  const openAdmin = useCallback(() => dispatch({ type: 'GOTO', screen: 'Admin' }), []);

  // 应用内「返回」：优先消费浏览器历史条目，与系统返回键行为一致
  const goBack = useCallback(() => {
    const nav = window.history.state as NavState | null;
    if (nav?.app && nav.depth > 0) {
      window.history.back();
    } else {
      dispatch({ type: 'BACK_HOME' });
    }
  }, []);

  // 「完成」回到首页：一次退回应用入口，避免历史里残留整条拍摄流程
  const goHome = useCallback(() => {
    const nav = window.history.state as NavState | null;
    if (nav?.app && nav.depth > 0) {
      window.history.go(-nav.depth);
    } else {
      dispatch({ type: 'BACK_HOME' });
    }
  }, []);

  const showLoginBtn = state.screen === 'S1' && !auth.user;

  let content: ReactNode;
  switch (state.screen) {
    case 'S1':
      content = (
        <>
          <S1TemplateList
            templates={templates}
            fallback={templatesFallback}
            onSelect={(template) => dispatch({ type: 'SELECT_TEMPLATE', template })}
            onOpenAll={() => dispatch({ type: 'GOTO', screen: 'AllTemplates' })}
          />
          {showLoginBtn && (
            <button className="auth-btn" onClick={() => setShowLogin(true)}>
              {UI_COPY.login}
            </button>
          )}
          {state.screen === 'S1' && (
            <AuthEntry
              onOpenAdmin={openAdmin}
              onOpenSetPassword={() => setShowSetPassword(true)}
            />
          )}
          {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
          {showSetPassword && <SetPasswordModal onClose={() => setShowSetPassword(false)} />}
        </>
      );
      break;
    case 'S2':
      content = (
        <S2IncludeGround
          includeGround={state.includeGround}
          onChange={(includeGround) => dispatch({ type: 'SET_INCLUDE_GROUND', includeGround })}
          onNext={() => dispatch({ type: 'GOTO', screen: 'S3' })}
        />
      );
      break;
    case 'S3':
      content = <S3Handoff onStart={startGuide} />;
      break;
    case 'S4':
      content = profile ? (
        <S4Guide
          profile={profile}
          hasSeenOnboarding={state.hasSeenOnboarding}
          onOnboardingSeen={onOnboardingSeen}
          onBack={goBack}
          onCameraFailure={onCameraFailure}
          onModelFailure={() => dispatch({ type: 'MODEL_FAILED' })}
          onCaptured={onCaptured}
        />
      ) : (
        <Pending screen="S4" />
      );
      break;
    case 'S5':
      content = (
        <S5Select
          photos={state.photos}
          onRetake={() => {
            dispatch({ type: 'SET_PHOTOS', photos: [] });
            dispatch({ type: 'GOTO', screen: 'S4' });
          }}
          onDone={goHome}
        />
      );
      break;
    case 'SManual':
      content = profile ? (
        <SManual
          profile={profile}
          onBack={goBack}
          onCameraFailure={onCameraFailure}
          onRetry={() => dispatch({ type: 'RETRY_MODELS' })}
          onCaptured={onCaptured}
        />
      ) : (
        <Pending screen="SManual" />
      );
      break;
    case 'SFallback':
      content = (
        <SFallback
          failure={state.failure ?? 'notFound'}
          briefing={(profile ?? PROFILES.half).briefing}
          onRetry={() => dispatch({ type: 'RETRY_CAMERA' })}
          onHome={goHome}
        />
      );
      break;
    case 'Admin':
      content = <AdminTemplates onBack={goBack} />;
      break;
    case 'AllTemplates':
      content = (
        <SAllTemplates
          templates={templates}
          onSelect={(template) => dispatch({ type: 'SELECT_TEMPLATE', template })}
          onBack={goBack}
        />
      );
      break;
    default:
      content = <Pending screen={state.screen} />;
  }

  // 懒加载分块的短暂空窗：留空容器即可，不放骨架屏，避免多一次闪动
  return <Suspense fallback={<div className="screen screen--center" />}>{content}</Suspense>;
}
