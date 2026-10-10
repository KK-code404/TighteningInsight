// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 配置内网开发代理与稳定构建输出，前后端可独立调试。
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
})

