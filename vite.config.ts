import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // 默认 5173 被 tools/serve.mjs 占用，Dev 服务器自动顺延端口。
  server: { host: true },
});
