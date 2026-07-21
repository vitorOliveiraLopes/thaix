'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useProgressData } from '@/hooks/useProgressData'
import { createClient } from '@/lib/supabase/client'
import { Flame, Dumbbell, Droplets, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PainChart } from '@/components/app/PainChart'

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const WEEKDAYS = ['D','S','T','Q','Q','S','S']

const SKILL_NAMES: Record<string, string> = {
  'pull-up': 'Pull-up', 'c2b': 'Chest to Bar',
  'bmu': 'Bar Muscle-up', 't2b': 'Toes-to-Bar', 'hspu': 'HSPU',
}
const SKILL_ICONS: Record<string, string> = {
  'pull-up': '🏋️', 'c2b': '💥', 'bmu': '🥇', 't2b': '✨', 'hspu': '🤸',
}
const LEVEL_LABELS: Record<string, string> = {
  iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado',
}

type SkillProgress = {
  skill_id: string
  level: string
  week_number: number
  sessions_at_current_level: number
}

type PainLog = {
  date: string
  pain_score: number
}

function MonthCalendar({
  year, month, workoutDates, hydrationDates, painDates
}: {
  year: number
  month: number
  workoutDates: Set<string>
  hydrationDates: Set<string>
  painDates: Map<string, number>
}) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date().toISOString().split('T')[0]

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function getPainEmoji(score: number) {
    if (score <= 2) return '😄'
    if (score <= 4) return '😐'
    if (score <= 6) return '😕'
    return '😣'
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold">{MONTHS[month]} {year}</p>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center text-xs text-muted-foreground py-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isWorkout = workoutDates.has(dateStr)
          const isHydration = hydrationDates.has(dateStr)
          const isToday = dateStr === today
          const painScore = painDates.get(dateStr)

          return (
            <div key={i} className="flex flex-col items-center gap-0.5 py-1">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs',
                isWorkout && 'bg-primary text-white font-bold',
                isToday && !isWorkout && 'border-2 border-primary',
              )}>
                {day}
              </div>
              <div className="flex items-center gap-0.5">
                {isHydration && <div className="w-1 h-1 rounded-full bg-blue-400" />}
                {painScore !== undefined && (
                  <span className="text-[8px] leading-none">{getPainEmoji(painScore)}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function DesempenhoPage() {
  const router = useRouter()
  const data = useProgressData()
  const [now] = useState(() => new Date())
  const [skillProgress, setSkillProgress] = useState<SkillProgress[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_skill_progress')
        .select('skill_id, level, week_number, sessions_at_current_level')
        .eq('user_id', user.id)
      setSkillProgress(data ?? [])
    }
    load()
  }, [])

  const workoutDates = new Set(data.workoutDays.map(w => w.date))
  const hydrationDates = new Set(
    data.hydrationDays.filter(h => h.met_goal).map(h => h.date)
  )
  const painDates = new Map(
    data.painLogs.map((p: PainLog) => [p.date, p.pain_score])
  )

  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear

  if (data.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto px-4 pt-10 space-y-6">

        <h1 className="text-2xl font-extrabold tracking-tight">Desempenho</h1>

        {/* Suas skills — topo, foco principal */}
        {skillProgress.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-extrabold text-base">Suas skills</h2>
            {skillProgress.map(skill => (
              <button
                key={skill.skill_id}
                onClick={() => router.push(`/desempenho/skills/${skill.skill_id}`)}
                className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-all text-left"
              >
                <span className="text-2xl">{SKILL_ICONS[skill.skill_id]}</span>
                <div className="flex-1">
                  <p className="font-extrabold text-sm">{SKILL_NAMES[skill.skill_id]}</p>
                  <p className="text-xs text-muted-foreground">
                    {LEVEL_LABELS[skill.level]} · Semana {skill.week_number}
                  </p>
                  <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min((skill.sessions_at_current_level / 6) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {skill.sessions_at_current_level} de 6 sessões para avançar
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Métricas — grid 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-1">
            <Dumbbell className="w-4 h-4 text-primary" />
            <p className="text-2xl font-bold tabular-nums">{data.totalWorkouts}</p>
            <p className="text-xs text-muted-foreground">treinos</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-1">
            <Droplets className="w-4 h-4 text-primary" />
            <p className="text-2xl font-bold tabular-nums">
              {data.hydrationDays.filter(h => h.met_goal).length}
            </p>
            <p className="text-xs text-muted-foreground">hidratações</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-1">
            <Flame className="w-4 h-4 text-primary" />
            <p className="text-2xl font-bold tabular-nums">{data.currentStreak}</p>
            <p className="text-xs text-muted-foreground">sequência atual</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-1">
            <Flame className="w-4 h-4 text-muted-foreground" />
            <p className="text-2xl font-bold tabular-nums">{data.maxStreak}</p>
            <p className="text-xs text-muted-foreground">maior sequência</p>
          </div>
        </div>

        {/* Calendários */}
        <div className="bg-white rounded-2xl p-5 space-y-6 shadow-sm">
          <MonthCalendar
            year={prevYear} month={prevMonth}
            workoutDates={workoutDates}
            hydrationDates={hydrationDates}
            painDates={painDates}
          />
          <div className="border-t border-border" />
          <MonthCalendar
            year={currentYear} month={currentMonth}
            workoutDates={workoutDates}
            hydrationDates={hydrationDates}
            painDates={painDates}
          />
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-primary" />
              <span>Treino</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span>Hidratação</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>😄</span>
              <span>Como você se sentiu</span>
            </div>
          </div>
        </div>

        {/* Como você se sentiu */}
        <div className="bg-white rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold">Como você se sentiu</h2>
            <span className="text-xs text-muted-foreground">
              {data.painLogs.length} registros
            </span>
          </div>
          <PainChart logs={data.painLogs} />
        </div>

        {/* Conquistas */}
        <button
          onClick={() => router.push('/treinos/conquistas')}
          className="w-full bg-white rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all"
        >
          <div className="space-y-0.5 text-left">
            <h2 className="font-extrabold">Conquistas</h2>
            <p className="text-sm text-muted-foreground">
              Ver todas as conquistas desbloqueadas
            </p>
          </div>
          <span className="text-2xl">🏆</span>
        </button>

        {/* PRs */}
        <button
          onClick={() => router.push('/treinos/prs')}
          className="w-full bg-white rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all"
        >
          <div className="space-y-0.5 text-left">
            <h2 className="font-extrabold">Recordes Pessoais</h2>
            <p className="text-sm text-muted-foreground">
              Acompanhe seus melhores resultados
            </p>
          </div>
          <span className="text-2xl">🥇</span>
        </button>

      </div>
    </div>
  )
}