// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 明细页实现联动筛选、排序、分页与当前筛选结果导出。
import { useEffect, useState } from 'react'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { api, queryString } from '../api'
import FilterBar, { initialFilters } from '../components/FilterBar'
import Panel from '../components/Panel'
import type { Filters, RecordRow } from '../types'

const columns: [keyof RecordRow, string][] = [['station','电枪工位'],['program','程序名称'],['esn','ESN'],['torque_upper','扭矩上限'],['torque_lower','扭矩下限'],['final_torque','最终扭矩'],['angle_upper','角度上限'],['angle_lower','角度下限'],['final_angle','最终角度'],['result_status','结果状态'],['result_time','ResultTime'],['bolt','螺栓']]

// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 管理明细筛选、分页和排序状态并保持当前筛选可导出。
export default function Records() {
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [applied, setApplied] = useState<Filters>(initialFilters)
  const [data, setData] = useState<{items: RecordRow[]; total: number}>({ items: [], total: 0 })
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('result_time')
  const [order, setOrder] = useState('desc')
  const load = () => api<any>(`/api/records?${queryString({ ...applied, page, size: 20, sort, order })}`).then(setData)
  useEffect(() => { void load() }, [applied, page, sort, order])
  const sortBy = (key: string) => { if (sort === key) setOrder(value => value === 'asc' ? 'desc' : 'asc'); else { setSort(key); setOrder('asc') } }
  const totalPages = Math.max(1, Math.ceil(data.total / 20))
  return <div className="page-stack"><FilterBar value={filters} onChange={setFilters} onSearch={() => { setApplied(filters); setPage(1) }}/><Panel title="拧紧数据明细" subtitle={`共 ${data.total.toLocaleString()} 条记录 · 默认按 ResultTime 倒序`} action={<a className="btn secondary" href={`/api/export?${queryString(applied)}`}><Download size={15}/>导出当前结果</a>}>
    <div className="table-scroll"><table className="data-table"><thead><tr>{columns.map(([key, label]) => <th key={key} onClick={() => sortBy(key)} className="sortable">{label}{sort === key ? <small>{order === 'asc' ? ' ↑' : ' ↓'}</small> : null}</th>)}</tr></thead><tbody>{data.items.map(row => <tr key={row.id}>{columns.map(([key]) => <td key={key}>{key === 'result_status' ? <span className={row[key] === 'Result was OK' ? 'result-ok' : 'result-nok'}>{row[key]}</span> : key === 'result_time' ? String(row[key]).replace('T',' ') : String(row[key] ?? '—')}</td>)}</tr>)}{!data.items.length ? <tr><td colSpan={12} className="empty-cell">没有符合条件的数据</td></tr> : null}</tbody></table></div>
    <div className="pagination"><span>第 {page} / {totalPages} 页</span><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16}/></button><button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={16}/></button></div>
  </Panel></div>
}
