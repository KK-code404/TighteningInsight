// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 趋势页按同一筛选条件展示扭矩与角度日均值及规格线。
import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { api, queryString } from '../api'
import { averageLimitOption, lineOption } from '../chartOptions'
import FilterBar, { initialFilters } from '../components/FilterBar'
import Panel from '../components/Panel'
import type { Filters } from '../types'

// CHANGE [2026-09-17 15:34 +08:00] [WH400]: 在扭矩主图说明中标明黄色 ±3σ 控制界限，帮助用户区分过程波动与规格上下限。
export default function Trends() {
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [applied, setApplied] = useState<Filters>(initialFilters)
  const [data, setData] = useState<any[]>([])
  useEffect(() => { api<any[]>(`/api/trends?${queryString(applied)}`).then(setData) }, [applied])
  // CHANGE [2026-09-17 14:59 +08:00] [WH400]: 用原平台的双图布局替换角度混合大图，便于并排核对扭矩和角度均值及各自规格上下限。
  return <div className="page-stack"><FilterBar value={filters} onChange={setFilters} onSearch={() => setApplied(filters)}/><div className="chart-summary"><span>统计天数<strong>{data.length}</strong></span><span>样本总数<strong>{data.reduce((sum, item) => sum + item.count, 0).toLocaleString()}</strong></span><span>最新日期<strong>{data.at(-1)?.date || '—'}</strong></span></div><Panel title="每日扭矩平均值" subtitle="红线为最终扭矩日均值，黄虚线为当前筛选结果的 ±3σ 控制界限"><ReactECharts option={lineOption(data, 'torque')} style={{height: 355}}/></Panel><div className="trend-average-grid"><Panel title="最终扭矩平均值" subtitle="灰色为均值，红色为规格上下限"><ReactECharts option={averageLimitOption(data, 'torque')} style={{height: 320}}/></Panel><Panel title="最终角度平均值" subtitle="灰色为均值，红色为规格上下限"><ReactECharts option={averageLimitOption(data, 'angle')} style={{height: 320}}/></Panel></div></div>
}
