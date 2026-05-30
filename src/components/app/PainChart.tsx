'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

type PainLog = {
  date: string
  pain_score: number
}

type Props = {
  logs: PainLog[]
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${day}/${month}`
}

function getTrend(logs: PainLog[]): { slope: number; improving: boolean } {
  if (logs.length < 2) return { slope: 0, improving: false }
  const n = logs.length
  const sumX = logs.reduce((acc, _, i) => acc + i, 0)
  const sumY = logs.reduce((acc, l) => acc + l.pain_score, 0)
  const sumXY = logs.reduce((acc, l, i) => acc + i * l.pain_score, 0)
  const sumX2 = logs.reduce((acc, _, i) => acc + i * i, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  return { slope, improving: slope < 0 }
}

export function PainChart({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Nenhum registro de dor ainda.
        </p>
      </div>
    )
  }

  const last30 = logs.slice(-30)
  const trend = getTrend(last30)
  const avg = last30.reduce((acc, l) => acc + l.pain_score, 0) / last30.length

  const data = last30.map(l => ({
    date: formatDate(l.date),
    dor: l.pain_score,
  }))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Média: <span className="font-medium text-foreground">
            {avg.toFixed(1)}/10
          </span>
        </span>
        <span className={trend.improving ? 'text-green-600' : 'text-orange-500'}>
          {trend.improving ? '↓ Melhorando' : trend.slope > 0 ? '↑ Atenção' : '→ Estável'}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            ticks={[0, 2, 4, 6, 8, 10]}
          />
          <Tooltip
            contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--background)',
            }}
            formatter={(value: unknown) => [`${value}/10`, 'Dor']}
          />
          <ReferenceLine
            y={avg}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
          <Line
            type="monotone"
            dataKey="dor"
            stroke="var(--foreground)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--foreground)' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted-foreground text-center">
        Últimos {last30.length} registros · linha tracejada = média
      </p>
    </div>
  )
}