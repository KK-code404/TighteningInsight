// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 初始化 React 应用并加载平台全局设计令牌。
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

