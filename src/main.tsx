import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './styles/global.css';

// @mediapipe/tasks-vision 内置 usage log（每 60s 向 odml.pa.googleapis.com 上报）。
// 本项目模型与 WASM 全自托管（SPEC §1.2），且照片只留在本机，故直接阻断；
// 返回 200 让库认为上报完成，避免它反复重试、在控制台留错。
const TELEMETRY_HOST = 'odml.pa.googleapis.com';
const originalFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes(TELEMETRY_HOST)) return Promise.resolve(new Response('', { status: 200 }));
  return originalFetch(input, init);
};

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
