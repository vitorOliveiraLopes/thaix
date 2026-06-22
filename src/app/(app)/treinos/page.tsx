'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProgressData } from '@/hooks/useProgressData'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Flame, Dumbbell, Clock, Droplets, Plus, X, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PainChart } from '@/components/app/PainChart'

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const WEEKDAYS = ['D','S','T','Q','Q','S','S']

function MonthCalendar({
  year, month, workoutDates, hydrationDates
}: {
  year: number
  month: number
  workoutDates: Set<string>
  hydrationDates: Set<string>
}) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date().toISOString().split('T')[0]

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {MONTHS[month]} {year}
      </p>
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

          return (
            <div key={i} className="flex flex-col items-center gap-0.5 py-1">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs',
                isWorkout && 'bg-foreground text-background font-medium',
                isToday && !isWorkout && 'border border-foreground',
              )}>
                {day}
              </div>
              {isHydration && (
                <div className="w-1 h-1 rounded-full bg-primary" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TreinosPage() {
  const router = useRouter()
  const data = useProgressData()
  const [now] = useState(() => new Date())

  const workoutDates = new Set(data.workoutDays.map(w => w.date))
  const hydrationDates = new Set(
    data.hydrationDays.filter(h => h.met_goal).map(h => h.date)
  )

  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear

  if (data.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto px-4 pt-10 space-y-6">

        <h1 className="text-2xl font-extrabold tracking-tight">Progresso</h1>

        {/* Totais */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted rounded-2xl p-4 space-y-1">
            <Dumbbell className="w-4 h-4 text-muted-foreground" />
            <p className="text-2xl font-bold tabular-nums">{data.totalWorkouts}</p>
            <p className="text-xs text-muted-foreground">treinos</p>
          </div>
          <div className="bg-muted rounded-2xl p-4 space-y-1">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <p className="text-2xl font-bold tabular-nums">{data.totalMinutes}</p>
            <p className="text-xs text-muted-foreground">minutos</p>
          </div>
          <div className="bg-muted rounded-2xl p-4 space-y-1">
            <Droplets className="w-4 h-4 text-muted-foreground" />
            <p className="text-2xl font-bold tabular-nums">
              {data.hydrationDays.filter(h => h.met_goal).length}
            </p>
            <p className="text-xs text-muted-foreground">hidratações</p>
          </div>
        </div>

        {/* Streak */}
        <div className="bg-white rounded-2xl p-5 flex shadow-sm">
          <div className="flex-1 flex flex-col items-center justify-center space-y-1">
            <div className="flex items-center gap-1">
              <Flame className="w-4 h-4 text-primary" />
              <span className="text-2xl font-bold tabular-nums">{data.currentStreak}</span>
            </div>
            <p className="text-xs text-muted-foreground">sequência atual</p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1 flex flex-col items-center justify-center space-y-1">
            <div className="flex items-center gap-1">
              <Flame className="w-4 h-4 text-muted-foreground" />
              <span className="text-2xl font-bold tabular-nums">{data.maxStreak}</span>
            </div>
            <p className="text-xs text-muted-foreground">maior sequência</p>
          </div>
        </div>

        {/* Calendários */}
        <div className="bg-white rounded-2xl p-5 space-y-6 shadow-sm">
          <MonthCalendar
            year={prevYear}
            month={prevMonth}
            workoutDates={workoutDates}
            hydrationDates={hydrationDates}
          />
          <div className="border-t border-border" />
          <MonthCalendar
            year={currentYear}
            month={currentMonth}
            workoutDates={workoutDates}
            hydrationDates={hydrationDates}
          />
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-foreground" />
              <span>Treino</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>Hidratação</span>
            </div>
          </div>
        </div>

        {/* Dor */}
        <div className="bg-white rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Evolução da dor</h2>
            <span className="text-xs text-muted-foreground">
              {data.painLogs.length} registros
            </span>
          </div>
          <PainChart logs={data.painLogs} />
        </div>

        {/* Conquistas */}
        <button
          onClick={() => router.push('/treinos/conquistas')}
          className="w-full border rounded-2xl p-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="space-y-0.5 text-left">
            <h2 className="font-medium">Conquistas</h2>
            <p className="text-sm text-muted-foreground">
              Ver todas as conquistas desbloqueadas
            </p>
          </div>
          <span className="text-2xl">🏆</span>
        </button>

        {/* PRs */}
        <button
          onClick={() => router.push('/treinos/prs')}
          className="w-full border rounded-2xl p-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="space-y-0.5 text-left">
            <h2 className="font-medium">Recordes Pessoais</h2>
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