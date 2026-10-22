import { useEffect, useRef, useState } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { historyChartData, type PortfolioSnapshot } from '../lib/history'
import { formatFiat } from '../lib/format'

export default function HistoryChart({ samples, currency, accent }: { samples: PortfolioSnapshot[]; currency: string; accent: string }) {
  const container = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<PortfolioSnapshot | undefined>()

  useEffect(() => {
    const element = container.current
    if (!element || samples.length < 2) return
    setSelected(undefined)
    const data = historyChartData(samples)
    const byTime = new Map(samples.map((s) => [s.timestamp / 1000, s]))
    const muted = getComputedStyle(element).getPropertyValue('--muted').trim()
    const grid = 'rgba(255,255,255,0.07)'
    const number = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
    const chart = new uPlot({
      width: Math.max(element.clientWidth, 200), height: 240,
      padding: [12, 12, 0, 0],
      legend: { show: false },
      select: { show: false, left: 0, top: 0, width: 0, height: 0 },
      cursor: { drag: { x: false, y: false }, points: { size: 7 } },
      scales: { x: { time: true } },
      series: [{}, { label: currency, stroke: accent, width: 2, spanGaps: false, points: { show: true, size: 4, stroke: accent, fill: accent } }],
      axes: [
        { stroke: muted, grid: { show: false }, ticks: { show: false }, font: '11px system-ui', space: 85 },
        { stroke: muted, grid: { stroke: grid, width: 1 }, ticks: { show: false }, font: '11px system-ui', size: 54, values: (_u, ticks) => ticks.map((n) => number.format(n)) },
      ],
      hooks: { setCursor: [(u) => {
        const time = u.cursor.idx == null ? undefined : data[0][u.cursor.idx]
        setSelected(time === undefined ? undefined : byTime.get(time))
      }] },
    }, data, element)
    const resize = new ResizeObserver(() => chart.setSize({ width: Math.max(element.clientWidth, 200), height: 240 }))
    resize.observe(element)
    return () => { resize.disconnect(); chart.destroy() }
  }, [samples, currency, accent])

  return (
    <>
      <div className="history-cursor" aria-live="off">
        {selected ? `${new Date(selected.timestamp).toLocaleString('en-US')} · ${formatFiat(selected.total, currency)}` : currency}
      </div>
      <div className="history-chart" ref={container} role="img" aria-label={`Recorded portfolio value in ${currency}`} />
    </>
  )
}
