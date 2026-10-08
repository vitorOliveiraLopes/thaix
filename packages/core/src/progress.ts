/**
 * ThaixSkill — Métricas de progresso e datas
 *
 * Tudo que a home e a tela de desempenho calculam a partir do histórico,
 * sem I/O. Datas sempre no formato ISO 'YYYY-MM-DD' no fuso do aparelho.
 */

/**
 * Data local no formato 'YYYY-MM-DD'.
 * Não usar toISOString(): ela converte para UTC e, no Brasil, depois das 21h
 * já devolve o dia seguinte.
 */
export function toLocalISODate(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Dias corridos entre duas datas ISO, sem efeito de horário de verão. */
export function daysBetween(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = fromISO.split('-').map(Number)
  const [y2, m2, d2] = toISO.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** Maior sequência de dias seguidos com treino em todo o histórico. */
export function calculateMaxStreak(workoutDates: string[]): number {
  const days = [...new Set(workoutDates)].sort()
  if (days.length === 0) return 0
  let max = 1
  let current = 1
  for (let i = 1; i < days.length; i++) {
    current = daysBetween(days[i - 1], days[i]) === 1 ? current + 1 : 1
    max = Math.max(max, current)
  }
  return max
}

/**
 * Tendência de uma série (regressão linear simples).
 * slope < 0 = caindo; > 0 = subindo. Menos de 2 pontos = estável.
 */
export function linearTrend(values: number[]): { slope: number; direction: 'down' | 'up' | 'flat' } {
  const n = values.length
  if (n < 2) return { slope: 0, direction: 'flat' }
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0
  values.forEach((y, x) => {
    sumX += x
    sumY += y
    sumXY += x * y
    sumX2 += x * x
  })
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const direction = Math.abs(slope) < 1e-9 ? 'flat' : slope < 0 ? 'down' : 'up'
  return { slope, direction }
}

/** Próximo dia de treino a partir de hoje (exclusive). `null` sem dias escolhidos. */
export function nextTrainingDay(trainingDays: number[], todayDow: number): number | null {
  if (trainingDays.length === 0) return null
  const sorted = [...new Set(trainingDays)].sort((a, b) => a - b)
  return sorted.find(d => d > todayDow) ?? sorted[0]
}

/** Células de um mês para calendário: `null` nos dias antes do dia 1. */
export function monthGrid(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
}

export function isoFor(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Saudação pela hora local. */
export function greeting(hour: number, name?: string | null): string {
  const first = name?.trim().split(/\s+/)[0]
  const base = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  return first ? `${base}, ${first}` : base
}

/** Trial vencido e sem assinatura ativa. Sem dados, não bloqueia. */
export function isTrialExpired(
  settings: { subscription_status: string | null; trial_ends_at: string | null } | null,
  now: number = Date.now(),
): boolean {
  if (!settings) return false
  if (settings.subscription_status !== 'trial') return false
  if (!settings.trial_ends_at) return false
  return new Date(settings.trial_ends_at).getTime() < now
}

export function trialDaysLeft(trialEndsAt: string | null, now: number = Date.now()): number | null {
  if (!trialEndsAt) return null
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now) / 86_400_000))
}
