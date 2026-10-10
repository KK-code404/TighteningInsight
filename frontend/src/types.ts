// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 统一 API 数据类型，减少图表与表格之间的字段理解偏差。
export type PageKey = 'dashboard' | 'records' | 'trends' | 'capability' | 'automation'

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

