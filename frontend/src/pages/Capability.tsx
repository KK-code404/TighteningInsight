// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 能力页展示标准公式指标、样本列表、直方图和 I-MR 控制趋势图。
import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { CircleHelp } from 'lucide-react'
import { api, queryString } from '../api'
import { controlOption, histogramOption } from '../chartOptions'
import FilterBar, { initialFilters } from '../components/FilterBar'
import Panel from '../components/Panel'
import type { Filters, Metrics } from '../types'

// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 以默认工位程序加载可复算的能力指标和控制图数据。
export default function Capability() {
  const [filters, setFilters] = useState<Filters>({ ...initialFilters, station: '60400', program: '190Nm' })
  const [applied, setApplied] = useState(filters)
  const [data, setData] = useState<any>({ metrics: null, items: [], series: [], histogram: [] })
  useEffect(() => { api(`/api/capability?${queryString(applied)}`).then(setData) }, [applied])
  const m: Metrics | null = data.metrics
  return <div className="page-stack"><FilterBar value={filters} onChange={setFilters} onSearch={() => setApplied(filters)}/><div className="metric-strip"><Metric label="CPK" value={m?.cpk}/><Metric label="PPK" value={m?.ppk}/><Metric label="MR 分母" value={m?.mrDenominator}/><Metric label="平均值控制线" value={m?.mean} unit="Nm"/></div><div className="capability-layout"><Panel title="样本明细" subtitle={`最近 ${data.items.length} 条`} className="sample-panel"><div className="sample-list"><table><thead><tr><th>#</th><th>ESN</th><th>最终扭矩</th><th>ResultTime</th></tr></thead><tbody>{data.items.slice().reverse().map((row: any, index: number) => <tr key={row.result_time + row.esn}><td>{index + 1}</td><td>{row.esn}</td><td>{row.final_torque}</td><td>{row.result_time.replace('T',' ')}</td></tr>)}</tbody></table></div></Panel><div className="cap-charts"><Panel title="扭矩分布柱状图" subtitle="直方图与 USL / LSL 参考线"><ReactECharts option={histogramOption(data.histogram, m)} style={{height: 310}}/></Panel><Panel title="最终扭矩控制趋势图" subtitle="I-MR：UCL/LCL = 均值 ± 2.66 × MR̄"><ReactECharts option={controlOption(data.series, m)} style={{height: 340}}/></Panel></div></div><div className="formula-note"><CircleHelp size={17}/><span><strong>计算口径：</strong>Cpk 使用移动极差估计组内标准差（MR̄ / 1.128），Ppk 使用样本标准差。当前按标准公式计算，建议与原 Power BI 报表作者核对。</span></div></div>
}

// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 对能力指标应用一致精度与阈值状态标签。
function Metric({ label, value, unit }: { label: string; value?: number | null; unit?: string }) { const good = (label === 'CPK' || label === 'PPK') && value != null && value >= 1.33; return <div><label>{label}</label><strong className={good ? 'good' : ''}>{value ?? '—'}</strong>{unit ? <span>{unit}</span> : null}{label === 'CPK' || label === 'PPK' ? <small className={good ? 'good-tag' : 'warn-tag'}>{value == null ? '待计算' : good ? '能力充足' : '需要关注'}</small> : null}</div> }
