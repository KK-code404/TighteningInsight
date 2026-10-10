// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 抽取统一筛选栏以保证三个分析页面使用同一查询口径。
import { RotateCcw, Search } from 'lucide-react'
import type { Filters } from '../types'

export const initialFilters: Filters = { station: '', program: '', esn: '', status: 'Result was OK', start: '', end: '' }

// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 将六类筛选字段和查询操作作为受控组件供分析页共享。
export default function FilterBar({ value, onChange, onSearch }: { value: Filters; onChange: (v: Filters) => void; onSearch: () => void }) {
  const field = (key: keyof Filters, next: string) => onChange({ ...value, [key]: next })
  return <div className="filter-bar">
    <label>电枪工位<input value={value.station} onChange={e => field('station', e.target.value)} placeholder="如 60400"/></label>
    <label>程序名称<input value={value.program} onChange={e => field('program', e.target.value)} placeholder="模糊搜索"/></label>
    <label>ESN<input value={value.esn} onChange={e => field('esn', e.target.value)} placeholder="输入 ESN"/></label>
    <label>结果状态<select value={value.status} onChange={e => field('status', e.target.value)}><option value="">全部结果</option><option>Result was OK</option><option>Result was NOK</option></select></label>
    <label>开始日期<input type="date" value={value.start} onChange={e => field('start', e.target.value)}/></label>
    <label>结束日期<input type="date" value={value.end} onChange={e => field('end', e.target.value)}/></label>
    <div className="filter-actions"><button className="btn secondary" onClick={() => onChange(initialFilters)}><RotateCcw size={15}/>重置</button><button className="btn primary" onClick={onSearch}><Search size={15}/>查询</button></div>
  </div>
}
