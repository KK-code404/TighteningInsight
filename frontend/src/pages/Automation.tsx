// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 自动化页将真实运行前提、七步流程与配置状态透明呈现，避免假装已连接内网。
import { Bot, CheckCircle2, Circle, Clock3, Play, ShieldCheck } from 'lucide-react'
import Panel from '../components/Panel'

const steps = ['登录 OA（支持全自动 / 半自动接管）','进入智能数据平台','质量部 → 工厂质量','打开“拧紧数据-近半年”','设置 ResultTime 结束日期为昨天','导出汇总数据 .xlsx','校验文件并等待平台导入']

// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 展示真实自动化能力与待配置边界，不在未接内网时伪造运行成功。
export default function Automation() {
  return <div className="page-stack automation-page"><div className="automation-hero"><div><Bot/><div><h2>自动导出任务</h2><p>Playwright 浏览器自动化 · 会话复用 · T-1 日期 · 失败重试</p></div></div><button className="btn primary" disabled title="请先配置 .env 并从本机命令行运行"><Play size={16}/>运行任务</button></div><div className="automation-grid"><Panel title="执行流程" subtitle="按需求文档的人工流程逐步自动化"><ol className="step-list">{steps.map((step, index) => <li key={step}><span>{index + 1}</span><div><strong>{step}</strong><small>{index === 0 ? '支持自签名证书与验证码人工接管' : index === 5 ? '.xlsx 上限 150,000 行' : '显式等待并保存关键截图'}</small></div><Circle size={18}/></li>)}</ol></Panel><div className="automation-side"><Panel title="运行配置"><dl className="config-list"><div><dt>运行模式</dt><dd>半自动（默认）</dd></div><div><dt>导出页签</dt><dd>拧紧数据明细</dd></div><div><dt>结束日期</dt><dd>每天自动取 T-1</dd></div><div><dt>重试次数</dt><dd>2 次</dd></div><div><dt>下载目录</dt><dd>./downloads</dd></div></dl></Panel><Panel title="启用真实任务"><div className="setup-steps"><p><ShieldCheck/>账号密码只写入本机 <code>.env</code>，日志不会打印密码。</p><pre>.venv\Scripts\python -m automation.exporter --mode semi-auto</pre><p><Clock3/>每日调度请在 Windows 任务计划程序中调用同一命令。</p></div></Panel></div></div><div className="info-banner"><CheckCircle2/><span>自动化实现已就绪；首次连接公司内网后需按实际 Power BI 版本校准画布定位器，再执行端到端验收。</span></div></div>
}
