// CHANGE [2026-09-17 16:11 +08:00] [WH400]: 按浅色 B 端驾驶舱重构应用外壳，同时保留五个核心页面和移动端抽屉导航。
import { useState } from 'react'
import { Activity, Bot, Database, Gauge, LayoutDashboard, Menu, Settings, Table2 } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Records from './pages/Records'
import Trends from './pages/Trends'
import Capability from './pages/Capability'
import Automation from './pages/Automation'
import type { PageKey } from './types'

const nav = [
  ['dashboard', '首页', LayoutDashboard], ['records', '拧紧数据明细', Table2],
  ['trends', '拧紧趋势监控', Activity], ['capability', '过程能力计算', Gauge],
  ['automation', '自动导出任务', Bot],
] as const

// CHANGE [2026-09-17 16:11 +08:00] [WH400]: 统一桌面与移动端导航状态，选择页面后自动收起移动侧栏并保持顶部状态信息简洁。
export default function App() {
  const [page, setPage] = useState<PageKey>('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const current = nav.find(item => item[0] === page)!
  return <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Database size={18}/></div><div><strong>拧紧数据</strong><span>自动导出与解析平台</span></div></div>
      <nav>{nav.map(([key, label, Icon]) => <button key={key} className={page === key ? 'active' : ''} onClick={() => { setPage(key); setCollapsed(false) }} title={label}><Icon size={17}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-foot"><button><Settings size={17}/><span>系统设置</span></button><div className="user"><span>WH</span><div><strong>WH400</strong><small>质量分析员</small></div></div></div>
    </aside>
    <main className="shell">
      <header className="topbar"><div><button className="icon-btn mobile-menu" onClick={() => setCollapsed(v => !v)} aria-label="切换菜单"><Menu size={20}/></button><h1>{current[1]}</h1><p>拧紧工艺数据质量分析与过程监控</p></div><div className="system-ok"><strong><i/>系统运行正常</strong><span>{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span><span>{new Date().toLocaleDateString('zh-CN', { weekday: 'short' })}</span></div></header>
      <div className="content">
        {page === 'dashboard' ? <Dashboard onNavigate={setPage}/> : null}
        {page === 'records' ? <Records/> : null}
        {page === 'trends' ? <Trends/> : null}
        {page === 'capability' ? <Capability/> : null}
        {page === 'automation' ? <Automation/> : null}
      </div>
    </main>
  </div>
}
