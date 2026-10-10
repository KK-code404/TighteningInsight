// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 复用企业报表图表主题和规格线样式，确保三类分析图视觉一致。
const colors = { blue: '#2f6fed', red: '#d84a4a', gray: '#65758b', teal: '#20a486', grid: '#e7ebf1' }

// CHANGE [2026-09-17 15:34 +08:00] [WH400]: 在扭矩日均趋势中按当前筛选结果计算样本标准差并绘制黄色 ±3σ 控制线，同时让纵轴完整包含控制界限。
export function lineOption(data: any[], kind: 'torque' | 'angle') {
  const torque = kind === 'torque'
  const avg = torque ? 'torque_avg' : 'angle_avg'
  const upper = torque ? 'torque_upper' : 'angle_upper'
  const lower = torque ? 'torque_lower' : 'angle_lower'
  const averageValues = data.map(item => Number(item[avg])).filter(Number.isFinite)
  const minimum = averageValues.length ? Math.min(...averageValues) : undefined
  const maximum = averageValues.length ? Math.max(...averageValues) : undefined
  const mean = averageValues.length ? averageValues.reduce((sum, value) => sum + value, 0) / averageValues.length : undefined
  const variance = mean != null && averageValues.length > 1
    ? averageValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (averageValues.length - 1)
    : undefined
  const sigma = variance != null ? Math.sqrt(variance) : undefined
  const upperControl = torque && mean != null && sigma != null ? mean + 3 * sigma : undefined
  const lowerControl = torque && mean != null && sigma != null ? mean - 3 * sigma : undefined
  const extentValues = [minimum, maximum, upperControl, lowerControl].filter((value): value is number => value != null && Number.isFinite(value))
  const extentMinimum = extentValues.length ? Math.min(...extentValues) : undefined
  const extentMaximum = extentValues.length ? Math.max(...extentValues) : undefined
  const spread = extentMinimum != null && extentMaximum != null ? extentMaximum - extentMinimum : 0
  const padding = torque && minimum != null ? Math.max(spread * 0.15, 0.05) : 0
  const yMinimum = torque && extentMinimum != null ? Math.floor((extentMinimum - padding) * 100) / 100 : undefined
  const yMaximum = torque && extentMaximum != null ? Math.ceil((extentMaximum + padding) * 100) / 100 : undefined
  const averageSeries = {
    name: torque ? '最终扭矩平均值' : '最终角度平均值', type: 'line',
    data: data.map(item => item[avg]), smooth: true, symbolSize: torque ? 8 : 5,
    lineStyle: { width: 2.5 }, itemStyle: torque ? { color: '#df2d1d' } : undefined,
  }
  const controlSeries = upperControl != null && lowerControl != null ? [
    { name: '+3σ 上限', type: 'line', data: data.map(() => upperControl), showSymbol: false, silent: true, lineStyle: { color: '#e4b21b', width: 2, type: 'dashed' } },
    { name: '-3σ 下限', type: 'line', data: data.map(() => lowerControl), showSymbol: false, silent: true, lineStyle: { color: '#e4b21b', width: 2, type: 'dashed' } },
  ] : []
  const series = torque ? [averageSeries, ...controlSeries] : [
    averageSeries,
    { name: '上限平均值', type: 'line', data: data.map(item => item[upper]), showSymbol: false, lineStyle: { type: 'dashed', width: 1.5 } },
    { name: '下限平均值', type: 'line', data: data.map(item => item[lower]), showSymbol: false, lineStyle: { type: 'dashed', width: 1.5 } },
  ]
  return {
    animationDuration: 500,
    color: torque ? ['#df2d1d', '#e4b21b', '#e4b21b'] : [colors.blue, colors.red, colors.red],
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${Number(v).toFixed(2)} ${torque ? 'Nm' : 'deg'}` },
    legend: { top: 0, right: 8, itemWidth: 18, textStyle: { color: '#536176', fontSize: 11 } },
    grid: { left: 48, right: 22, top: 48, bottom: 36 },
    xAxis: { type: 'category', data: data.map(item => item.date.slice(5)), boundaryGap: false, axisLabel: { color: '#8290a3', hideOverlap: true }, axisLine: { lineStyle: { color: colors.grid } } },
    yAxis: { type: 'value', name: torque ? '扭矩 (Nm)' : '角度 (deg)', scale: torque, min: yMinimum, max: yMaximum, nameTextStyle: { color: '#8290a3' }, axisLabel: { color: '#8290a3' }, splitLine: { lineStyle: { color: colors.grid } } },
    series,
  }
}

// CHANGE [2026-09-17 14:59 +08:00] [WH400]: 将扭矩与角度均值分别按原 Power BI 的灰色数据点、红色上下限绘制，供趋势页并排对照。
export function averageLimitOption(data: any[], kind: 'torque' | 'angle') {
  const torque = kind === 'torque'
  const avg = torque ? 'torque_avg' : 'angle_avg'
  const upper = torque ? 'torque_upper' : 'angle_upper'
  const lower = torque ? 'torque_lower' : 'angle_lower'
  const unit = torque ? 'Nm' : 'deg'
  return {
    animationDuration: 500,
    color: [colors.gray, '#df2d1d', '#df2d1d'],
    tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${Number(value).toFixed(2)} ${unit}` },
    legend: { top: 0, left: 8, itemWidth: 13, itemHeight: 8, textStyle: { color: '#536176', fontSize: 10 } },
    grid: { left: 50, right: 18, top: 46, bottom: 38 },
    xAxis: { type: 'category', data: data.map(item => item.date.slice(5)), boundaryGap: false, axisLabel: { color: '#8290a3', hideOverlap: true }, axisLine: { lineStyle: { color: colors.grid } } },
    yAxis: { type: 'value', name: torque ? '扭矩 (Nm)' : '角度 (deg)', scale: true, nameTextStyle: { color: '#8290a3' }, axisLabel: { color: '#8290a3' }, splitLine: { lineStyle: { color: colors.grid, type: 'dotted' } } },
    series: [
      { name: torque ? '最终扭矩平均值' : '最终角度平均值', type: 'line', data: data.map(item => item[avg]), symbolSize: 7, lineStyle: { color: colors.gray, width: 1 }, itemStyle: { color: colors.gray } },
      { name: torque ? '扭矩上限平均值' : '角度上限平均值', type: 'line', data: data.map(item => item[upper]), showSymbol: false, lineStyle: { color: '#df2d1d', width: 2 } },
      { name: torque ? '扭矩下限平均值' : '角度下限平均值', type: 'line', data: data.map(item => item[lower]), showSymbol: false, lineStyle: { color: '#df2d1d', width: 2 } },
    ],
  }
}

// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 将频次分布与规格参考线组合为过程能力直方图。
export function histogramOption(data: any[], metrics: any) {
  // CHANGE [2026-09-09 15:18 +08:00] [WH400]: 分类轴规格线使用最近柱索引，避免 ECharts 将连续数值解析为无效坐标。
  const closestIndex = (target?: number) => {
    if (target == null || !data.length) return 0
    let best = 0
    for (let index = 1; index < data.length; index += 1) {
      if (Math.abs(data[index].center - target) < Math.abs(data[best].center - target)) best = index
    }
    return best
  }
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 22, top: 38, bottom: 38 },
    xAxis: { type: 'category', data: data.map(item => item.center), axisLabel: { color: '#8290a3', interval: 'auto' }, name: '最终扭矩 (Nm)' },
    yAxis: { type: 'value', name: '频次', splitLine: { lineStyle: { color: colors.grid } } },
    series: [{ type: 'bar', name: '频次', data: data.map(item => item.count), itemStyle: { color: colors.blue, borderRadius: [4, 4, 0, 0] },
      markLine: { symbol: 'none', label: { formatter: '{b}' }, data: [
        { name: 'LSL', xAxis: closestIndex(metrics?.lsl), lineStyle: { color: colors.red } },
        { name: 'USL', xAxis: closestIndex(metrics?.usl), lineStyle: { color: colors.red } },
      ] } }],
  }
}

// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 叠加规格线、控制线和均值线以呈现最终扭矩稳定性。
export function controlOption(series: number[], metrics: any) {
  const lines = metrics ? [['USL', metrics.usl, colors.red], ['LSL', metrics.lsl, colors.red], ['UCL', metrics.ucl, '#e58a25'], ['LCL', metrics.lcl, '#e58a25'], ['平均值', metrics.mean, colors.gray]] : []
  return {
    tooltip: { trigger: 'axis' }, legend: { data: ['最终扭矩'], right: 10 },
    grid: { left: 50, right: 25, top: 42, bottom: 36 },
    xAxis: { type: 'category', data: series.map((_, index) => index + 1), name: '样本序号', axisLabel: { color: '#8290a3' } },
    yAxis: { type: 'value', name: '扭矩 (Nm)', splitLine: { lineStyle: { color: colors.grid } } },
    series: [{ type: 'line', name: '最终扭矩', data: series, showSymbol: false, lineStyle: { color: colors.blue, width: 1.4 },
      markLine: { symbol: 'none', data: lines.map(([name, yAxis, color]) => ({ name, yAxis, label: { formatter: String(name) }, lineStyle: { color, type: 'dashed' } })) } }],
  }
}
