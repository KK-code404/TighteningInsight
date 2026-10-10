// CHANGE [2026-09-17 16:11 +08:00] [WH400]: 依据浅色经营驾驶舱参考重排首页信息层级，并保留导入反馈、趋势与能力分析功能。
import { useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { ArrowRight, CheckCircle2, Clock3, Database, FileSpreadsheet, Gauge, LoaderCircle, UploadCloud } from 'lucide-react'
import { api } from '../api'
import { lineOption } from '../chartOptions'
import Panel from '../components/Panel'
import type { PageKey } from '../types'

// CHANGE [2026-09-17 16:11 +08:00] [WH400]: 将指标、趋势、任务与导入组织为主分析区和操作侧栏，强化首页扫描效率且不改变数据请求口径。
export default function Dashboard({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const [summary, setSummary] = useState<any>(null)
  const [trends, setTrends] = useState<any[]>([])
  const [capability, setCapability] = useState<any>(null)
  const [notice, setNotice] = useState('')
  const [importing, setImporting] = useState<{ fileName: string; phase: string } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const refresh = () => Promise.all([api('/api/dashboard'), api('/api/trends?status=Result%20was%20OK'), api('/api/capability?station=60400&program=190Nm&status=Result%20was%20OK')])
    .then(([s, t, c]) => { setSummary(s); setTrends(t as any[]); setCapability(c) })
  useEffect(() => { void refresh() }, [])
  useEffect(() => {
    if (!importing) return
    setElapsed(0)
    const timer = window.setInterval(() => setElapsed(value => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [importing?.fileName])
  const upload = async (file?: File) => {
    if (!file || importing) return
    const body = new FormData(); body.append('file', file)
    setNotice('')
    setImporting({ fileName: file.name, phase: '正在上传并解析数据' })
    try {
      const result: any = await api('/api/import', { method: 'POST', body })
      setImporting({ fileName: file.name, phase: '解析完成，正在更新统计' })
      await refresh()
      setNotice(`导入完成：新增 ${result.accepted} 行，跳过 ${result.skipped} 行`)
    }
    catch (error) { setNotice(error instanceof Error ? error.message : '导入失败') }
    finally { setImporting(null); if (inputRef.current) inputRef.current.value = '' }
  }
  const loadDemo = async () => {
    if (importing) return
    setNotice('')
    setImporting({ fileName: '脱敏演示数据.xlsx', phase: '正在生成并解析演示数据' })
    try {
      const result: any = await api('/api/demo', { method: 'POST' })
      setImporting({ fileName: '脱敏演示数据.xlsx', phase: '解析完成，正在更新统计' })
      await refresh()
      setNotice(`演示数据已载入：新增 ${result.accepted} 行`)
    } catch (error) { setNotice(error instanceof Error ? error.message : '演示数据载入失败') }
    finally { setImporting(null) }
  }
  const metrics = useMemo(() => capability?.metrics, [capability])
  return <div className="dashboard-grid">
    {notice ? <div className="toast" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div> : null}
    <div className="kpis">
      <Kpi tone="blue" icon={<Database/>} label="数据总量" value={(summary?.recordCount || 0).toLocaleString()} suffix="条"/>
      <Kpi tone="green" icon={<CheckCircle2/>} label="合格率" value={`${summary?.passRate || 0}%`} good/>
      <Kpi tone="orange" icon={<FileSpreadsheet/>} label="导入批次" value={(summary?.importBatches || 0).toLocaleString()} suffix="批"/>
      <Kpi tone="violet" icon={<Clock3/>} label="最新导入" value={summary?.latestImport?.imported_at?.slice(0, 16).replace('T', ' ') || '—'}/>
    </div>
    <div className="dashboard-main">
      <Panel title="每日扭矩趋势" subtitle="最终扭矩日均值及 ±3σ 控制界限" className="trend-panel" action={<button className="text-link" onClick={() => onNavigate('trends')}>查看详情 <ArrowRight size={14}/></button>}><ReactECharts option={lineOption(trends, 'torque')} style={{ height: 300 }}/></Panel>
      <Panel title="过程能力分析" subtitle="60400 · 190Nm · 标准 I-MR 口径" className="cap-panel" action={<button className="text-link" onClick={() => onNavigate('capability')}>查看详情 <ArrowRight size={14}/></button>}>
        <div className="cap-values"><CapabilityValue label="CPK" value={metrics?.cpk}/><CapabilityValue label="PPK" value={metrics?.ppk}/></div>
        <div className="cap-summary"><Gauge/><div><strong>{metrics && metrics.cpk >= 1.33 ? '过程能力满足要求' : metrics ? '过程能力需关注' : '等待数据'}</strong><span>{metrics ? `均值 ${metrics.mean} Nm · USL ${metrics.usl} · LSL ${metrics.lsl}` : '载入数据后自动计算'}</span></div></div>
      </Panel>
    </div>
    <div className="dashboard-rail">
      <Panel title="当前任务状态" className="task-panel" action={<button className="text-link" onClick={() => onNavigate('automation')}>查看详情 <ArrowRight size={14}/></button>}>
        <div className="task-status"><div className="status-icon"><CheckCircle2/></div><div className="task-copy"><strong>空闲中</strong><span>暂无执行中的导出任务</span></div><dl><div><dt>最近导入</dt><dd>{summary?.latestImport?.imported_at?.slice(0, 16).replace('T', ' ') || '尚未导入'}</dd></div><div><dt>导入记录</dt><dd>{summary?.latestImport?.accepted_rows?.toLocaleString() || 0} 条</dd></div></dl></div>
      </Panel>
      <Panel title="导入数据文件" className="upload-panel"><div className="upload-body" aria-busy={Boolean(importing)}><button className="dropzone" disabled={Boolean(importing)} onClick={() => inputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files[0]) }}><UploadCloud/><strong>点击选择或拖拽文件到此处</strong><span>支持 XLSX、CSV，单个文件不超过 500MB</span></button><input ref={inputRef} hidden disabled={Boolean(importing)} type="file" accept=".xlsx,.csv" onChange={e => void upload(e.target.files?.[0])}/><button className="demo-link" disabled={Boolean(importing)} onClick={() => void loadDemo()}>载入脱敏演示数据</button>{importing ? <div className="import-overlay" role="status" aria-live="polite"><LoaderCircle className="import-spinner"/><strong>{importing.phase}</strong><span>{importing.fileName}</span><small>已等待 {elapsed} 秒 · 大文件解析可能需要 1–2 分钟，请勿关闭页面</small></div> : null}</div></Panel>
    </div>
    <Panel title="最近活动记录" className="activity-panel"><table><thead><tr><th>时间</th><th>类型</th><th>文件名 / 任务名</th><th>记录数</th><th>状态</th></tr></thead><tbody>{(summary?.activities || []).map((row: any) => <tr key={row.time + row.name}><td>{row.time.replace('T', ' ')}</td><td>{row.type}</td><td>{row.name}</td><td>{row.row_count.toLocaleString()}</td><td><span className="status-dot"/>已完成</td></tr>)}{!summary?.activities?.length ? <tr><td colSpan={5} className="empty-cell">暂无活动，导入文件或载入演示数据开始分析</td></tr> : null}</tbody></table></Panel>
  </div>
}

// CHANGE [2026-09-17 16:11 +08:00] [WH400]: 为四项真实业务指标提供可复用的淡彩色图标语义，贴近参考驾驶舱的快速扫描体验。
function Kpi({ icon, label, value, suffix, good, tone }: any) { return <div className={`kpi kpi-${tone}`}><span className="kpi-icon">{icon}</span><div><label>{label}</label><strong className={good ? 'good' : ''}>{value}</strong>{suffix ? <small>{suffix}</small> : null}</div></div> }

// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 根据 1.33 阈值给首页能力值提供直观状态反馈。
function CapabilityValue({ label, value }: { label: string; value?: number }) { const good = value !== undefined && value !== null && value >= 1.33; return <div><label>{label}</label><strong>{value ?? '—'}</strong><span className={good ? 'good-tag' : 'warn-tag'}>{value == null ? '待计算' : good ? '能力充足' : '需要关注'}</span></div> }
