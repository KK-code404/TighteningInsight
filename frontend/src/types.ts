// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 统一 API 数据类型，减少图表与表格之间的字段理解偏差。
// CHANGE [2026-10-10 13:20 +08:00] [WH400]: 将邮件告警配置纳入应用页面类型，保证侧栏导航与页面渲染保持类型安全。
export type PageKey = 'dashboard' | 'records' | 'trends' | 'capability' | 'automation' | 'alerts'

export interface Filters {
  station: string
  program: string
  esn: string
  status: string
  start: string
  end: string
}

export interface RecordRow {
  id: number; station: string; program: string; esn: string
  torque_upper: number; torque_lower: number; final_torque: number
  angle_upper: number; angle_lower: number; final_angle: number
  result_status: string; result_time: string; bolt: string
}

export interface Metrics {
  cpk: number | null; ppk: number | null; mrDenominator: number; mean: number
  usl: number; lsl: number; ucl: number; lcl: number; stdev: number
}

// CHANGE [2026-10-10 13:20 +08:00] [WH400]: 统一前后端邮件配置字段并仅暴露密码是否已保存，不在浏览器回显凭据。
export interface EmailAlertConfig {
  enabled: boolean
  smtp_host: string
  smtp_port: number
  security: 'starttls' | 'ssl' | 'none'
  username: string
  password: string
  passwordConfigured: boolean
  sender: string
  recipients: string
  subject_prefix: string
  station: string
  program: string
  result_status: string
  updated_at?: string | null
  last_checked_at?: string | null
  last_sent_at?: string | null
  last_error?: string | null
  lastEvent?: { event_date: string; direction: string; torque_average: number; sent_at: string } | null
}

