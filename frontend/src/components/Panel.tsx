// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 提供简洁面板容器，统一标题、说明与右侧操作布局。
import type { ReactNode } from 'react'

// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 通过可选说明与操作区复用分析面板结构。
export default function Panel({ title, subtitle, action, className = '', children }: { title: string; subtitle?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return <section className={`panel ${className}`}><div className="panel-head"><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>{action}</div>{children}</section>
}
