// CHANGE [2026-10-10 13:20 +08:00] [WH400]: 新增邮件告警配置页，让管理员在平台内维护 SMTP、收件人和 ±3σ 监控范围。
import { useEffect, useState } from 'react'
import { BellRing, CheckCircle2, MailCheck, Play, Save, Send, ShieldCheck, TriangleAlert } from 'lucide-react'
import { api } from '../api'
import Panel from '../components/Panel'
import type { EmailAlertConfig } from '../types'

// CHANGE [2026-10-10 13:20 +08:00] [WH400]: 用安全的禁用默认值初始化表单，接口返回前不假设任何 SMTP 凭据。
const emptyConfig: EmailAlertConfig = {
  enabled: false, smtp_host: '', smtp_port: 587, security: 'starttls', username: '', password: '',
  passwordConfigured: false, sender: '', recipients: '', subject_prefix: '[拧紧数据告警]',
  station: '', program: '', result_status: 'Result was OK',
}

// CHANGE [2026-10-10 13:20 +08:00] [WH400]: 保存、测试和立即检测均复用当前表单，测试前自动保存以避免验证旧配置。
export default function EmailAlerts() {
  const [form, setForm] = useState<EmailAlertConfig>(emptyConfig)
  const [loading, setLoading] = useState<'load' | 'save' | 'test' | 'check' | ''>('load')
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    api<EmailAlertConfig>('/api/alert-config')
      .then(config => setForm({ ...emptyConfig, ...config, password: '' }))
      .catch(error => setNotice({ tone: 'error', text: error instanceof Error ? error.message : '配置加载失败' }))
      .finally(() => setLoading(''))
  }, [])

  const field = <K extends keyof EmailAlertConfig>(key: K, value: EmailAlertConfig[K]) => {
    setForm(current => ({ ...current, [key]: value }))
  }
  const payload = () => ({
    enabled: form.enabled, smtp_host: form.smtp_host, smtp_port: Number(form.smtp_port), security: form.security,
    username: form.username, password: form.password, sender: form.sender, recipients: form.recipients,
    subject_prefix: form.subject_prefix, station: form.station, program: form.program, result_status: form.result_status,
  })
  const save = async (showNotice = true) => {
    const saved = await api<EmailAlertConfig>('/api/alert-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()),
    })
    setForm(current => ({ ...current, ...saved, password: '' }))
    if (showNotice) setNotice({ tone: 'ok', text: '邮件告警配置已保存' })
    return saved
  }
  const run = async (action: 'save' | 'test' | 'check') => {
    setLoading(action); setNotice(null)
    try {
      if (action === 'save') await save()
      if (action === 'test') {
        await save(false)
        const result = await api<{ recipients: string[] }>('/api/alert-config/test', { method: 'POST' })
        setNotice({ tone: 'ok', text: `测试邮件已发送至 ${result.recipients.join('、')}` })
      }
      if (action === 'check') {
        await save(false)
        const result = await api<{ checked: number; breaches: number; sent: number }>('/api/alert-config/check', { method: 'POST' })
        setNotice({ tone: 'ok', text: `检测完成：${result.checked} 天，发现 ${result.breaches} 个越界点，本次发送 ${result.sent} 条提醒` })
        const refreshed = await api<EmailAlertConfig>('/api/alert-config')
        setForm(current => ({ ...current, ...refreshed, password: '' }))
      }
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : '操作失败' })
    } finally {
      setLoading('')
    }
  }

  return <div className="page-stack alerts-page">
    <div className="alert-hero">
      <div className="alert-hero-icon"><BellRing/></div>
      <div><h2>±3σ 越界邮件提醒</h2><p>每日最终扭矩平均值超过黄色控制线时，自动向质量负责人发送邮件。</p></div>
      <label className="switch"><input type="checkbox" checked={form.enabled} onChange={event => field('enabled', event.target.checked)}/><span/><strong>{form.enabled ? '已启用' : '未启用'}</strong></label>
    </div>

    {notice ? <div className={`alert-notice ${notice.tone}`} role="status">{notice.tone === 'ok' ? <CheckCircle2/> : <TriangleAlert/>}<span>{notice.text}</span></div> : null}

    <div className="alert-settings-grid">
      <Panel title="SMTP 邮箱配置" subtitle="密码仅保存在本机数据库，页面和接口不会回显明文">
        <div className="settings-form">
          <label className="wide">SMTP 服务器<input value={form.smtp_host} onChange={e => field('smtp_host', e.target.value)} placeholder="例如 smtp.company.com"/></label>
          <label>端口<input type="number" min="1" max="65535" value={form.smtp_port} onChange={e => field('smtp_port', Number(e.target.value))}/></label>
          <label>连接安全<select value={form.security} onChange={e => field('security', e.target.value as EmailAlertConfig['security'])}><option value="starttls">STARTTLS</option><option value="ssl">SSL / TLS</option><option value="none">无加密（内网）</option></select></label>
          <label>登录账号<input value={form.username} onChange={e => field('username', e.target.value)} placeholder="可留空（免鉴权服务器）"/></label>
          <label>登录密码<input type="password" value={form.password} onChange={e => field('password', e.target.value)} placeholder={form.passwordConfigured ? '已保存，留空保持不变' : '请输入密码或授权码'}/></label>
          <label>发件邮箱<input type="email" value={form.sender} onChange={e => field('sender', e.target.value)} placeholder="quality@company.com"/></label>
          <label className="wide">收件邮箱<textarea value={form.recipients} onChange={e => field('recipients', e.target.value)} placeholder="多个邮箱用逗号、分号或换行分隔"/></label>
          <label className="wide">邮件主题前缀<input value={form.subject_prefix} onChange={e => field('subject_prefix', e.target.value)} placeholder="[拧紧数据告警]"/></label>
        </div>
      </Panel>

      <div className="alert-side">
        <Panel title="监控范围" subtitle="与趋势监控页面筛选口径一致">
          <div className="settings-form compact">
            <label>电枪工位<input value={form.station} onChange={e => field('station', e.target.value)} placeholder="留空监控全部"/></label>
            <label>程序名称<input value={form.program} onChange={e => field('program', e.target.value)} placeholder="留空监控全部"/></label>
            <label className="wide">结果状态<select value={form.result_status} onChange={e => field('result_status', e.target.value)}><option value="">全部结果</option><option>Result was OK</option><option>Result was NOK</option></select></label>
          </div>
        </Panel>
        <Panel title="运行状态" subtitle="导入数据后自动检查，也可手动立即检查">
          <div className="alert-status-list">
            <div><span>最近检查</span><strong>{formatTime(form.last_checked_at)}</strong></div>
            <div><span>最近发送</span><strong>{formatTime(form.last_sent_at)}</strong></div>
            <div><span>密码状态</span><strong className={form.passwordConfigured ? 'good' : ''}>{form.passwordConfigured ? '已本机保存' : '未配置'}</strong></div>
            <div><span>最近异常</span><strong className={form.last_error ? 'error-text' : ''}>{form.last_error || '无'}</strong></div>
          </div>
        </Panel>
      </div>
    </div>

    <div className="alert-actions">
      <div><ShieldCheck/><span>同一日期、方向和监控范围只发送一次，避免重复邮件。</span></div>
      <div>
        <button className="btn secondary" disabled={Boolean(loading)} onClick={() => void run('test')}><Send size={15}/>{loading === 'test' ? '发送中…' : '保存并发送测试邮件'}</button>
        <button className="btn secondary" disabled={Boolean(loading)} onClick={() => void run('check')}><Play size={15}/>{loading === 'check' ? '检测中…' : '保存并立即检测'}</button>
        <button className="btn primary" disabled={Boolean(loading)} onClick={() => void run('save')}><Save size={15}/>{loading === 'save' ? '保存中…' : '保存配置'}</button>
      </div>
    </div>

    <div className="alert-info"><MailCheck/><div><strong>触发规则</strong><span>按当前监控范围聚合每日最终扭矩平均值，使用全部日均值的样本标准差计算均值 ±3σ。新数据导入后，越界日期会自动合并成一封邮件。</span></div></div>
  </div>
}

// CHANGE [2026-10-10 13:20 +08:00] [WH400]: 将空状态和 ISO 时间统一转为页面可读格式。
function formatTime(value?: string | null) {
  return value ? value.slice(0, 19).replace('T', ' ') : '尚无记录'
}
