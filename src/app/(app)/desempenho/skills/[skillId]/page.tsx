'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, ChevronRight, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Constants ───────────────────────────────────────────────────────────────

const SKILL_NAMES: Record<string, string> = {
  'pull-up': 'Pull-up',
  'c2b': 'Chest to Bar',
  'bmu': 'Bar Muscle-up',
  't2b': 'Toes-to-Bar',
  'hspu': 'HSPU',
}

const SKILL_ICONS: Record<string, string> = {
  'pull-up': '🏋️',
  'c2b': '💥',
  'bmu': '🥇',
  't2b': '✨',
  'hspu': '🤸',
}

const LEVEL_LABELS: Record<string, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
}

const EFFORT_LABELS: Record<number, string> = {
  1: 'Muito fácil',
  2: 'Fácil',
  3: 'Na medida',
  4: 'Difícil',
  5: 'Muito difícil',
}

const EFFORT_COLORS: Record<number, string> = {
  1: 'text-green-500',
  2: 'text-green-400',
  3: 'text-yellow-500',
  4: 'text-orange-500',
  5: 'text-red-500',
}

// ─── Types ───────────────────────────────────────────────────────────────────

type WorkoutItem = {
  exercise_name: string
  sets: number
  reps: number | null
  time_sec: number | null
  reps_achieved: number | null
  time_achieved_sec: number | null
  perceived_effort: number | null
}

type WorkoutHistory = {
  id: string
  date: string
  week_number: number
  completed_at: string | null
  is_redo: boolean  // true se foi gerado via "Refazer" (source_workout_id IS NOT NULL)
  items: WorkoutItem[]
}

type LevelChange = {
  from_level: string | null
  to_level: string
  week_number: number
  changed_at: string
}

type SkillProgressData = {
  level: string
  week_number: number
  sessions_at_current_level: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SkillHistoryPage() {
  const { skillId } = useParams<{ skillId: string }>()
  const router = useRouter()

  const [workouts, setWorkouts] = useState<WorkoutHistory[]>([])
  const [levelHistory, setLevelHistory] = useState<LevelChange[]>([])
  const [progress, setProgress] = useState<SkillProgressData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      /**
       * Query 1 — treinos concluídos com seus itens (join 2 níveis, sem ambiguidade).
       * Não tentamos fazer o 3º nível (daily_workout_results) aqui porque a constraint
       * composta (daily_workout_id, skill_exercise_id) confunde o PostgREST e retorna
       * resultados vazios silenciosamente.
       */
      const [workoutsRes, levelRes, progressRes] = await Promise.all([
        supabase
          .from('daily_workouts')
          .select(`
            id, date, week_number, completed_at, source_workout_id,
            daily_workout_items (
              id,
              sets, reps, time_sec,
              skill_exercise_id,
              skill_exercises ( exercise_name )
            )
          `)
          .eq('user_id', user.id)
          .eq('skill_id', skillId)
          .not('completed_at', 'is', null)
          .order('date', { ascending: false }),

        supabase
          .from('skill_level_history')
          .select('from_level, to_level, week_number, changed_at')
          .eq('user_id', user.id)
          .eq('skill_id', skillId)
          .order('changed_at', { ascending: false }),

        supabase
          .from('user_skill_progress')
          .select('level, week_number, sessions_at_current_level')
          .eq('user_id', user.id)
          .eq('skill_id', skillId)
          .single(),
      ])

      const rawWorkouts = workoutsRes.data ?? []

      /**
       * Query 2 — resultados dos treinos buscados acima, numa única chamada.
       * Indexamos pelo par (workoutId, exerciseId) espelhando a constraint do banco,
       * depois injetamos nos itens durante o mapeamento.
       */
      type ResultRecord = {
        reps_achieved: number | null
        time_achieved_sec: number | null
        perceived_effort: number | null
      }
      const resultsMap = new Map<string, ResultRecord>()

      if (rawWorkouts.length > 0) {
        const workoutIds = rawWorkouts.map((w: any) => w.id)

        const { data: resultsData } = await supabase
          .from('daily_workout_results')
          .select('daily_workout_id, skill_exercise_id, reps_achieved, time_achieved_sec, perceived_effort')
          .in('daily_workout_id', workoutIds)

        for (const r of (resultsData ?? [])) {
          resultsMap.set(`${r.daily_workout_id}|${r.skill_exercise_id}`, {
            reps_achieved: r.reps_achieved,
            time_achieved_sec: r.time_achieved_sec,
            perceived_effort: r.perceived_effort,
          })
        }
      }

      // Montar o shape final injetando resultados via resultsMap
      const mapped: WorkoutHistory[] = rawWorkouts.map((w: any) => ({
        id: w.id,
        date: w.date,
        week_number: w.week_number,
        completed_at: w.completed_at,
        is_redo: !!w.source_workout_id,
        items: (w.daily_workout_items ?? []).map((item: any) => {
          const result = resultsMap.get(`${w.id}|${item.skill_exercise_id}`)
          return {
            exercise_name: item.skill_exercises?.exercise_name ?? '',
            sets: item.sets,
            reps: item.reps,
            time_sec: item.time_sec,
            reps_achieved: result?.reps_achieved ?? null,
            time_achieved_sec: result?.time_achieved_sec ?? null,
            perceived_effort: result?.perceived_effort ?? null,
          } satisfies WorkoutItem
        }),
      }))

      setWorkouts(mapped)
      setLevelHistory(levelRes.data ?? [])
      setProgress(progressRes.data)
      setLoading(false)
    }

    load()
  }, [skillId])

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Agrupar treinos por semana (decrescente)
  const byWeek = workouts.reduce<Record<number, WorkoutHistory[]>>((acc, w) => {
    acc[w.week_number] ??= []
    acc[w.week_number].push(w)
    return acc
  }, {})
  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => b - a)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto px-4 pt-10 space-y-6">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {/* Skill header */}
        <div className="flex items-center gap-3">
          <span className="text-4xl">{SKILL_ICONS[skillId]}</span>
          <div>
            <h1 className="text-2xl font-extrabold">{SKILL_NAMES[skillId]}</h1>
            {progress && (
              <p className="text-sm text-muted-foreground">
                {LEVEL_LABELS[progress.level]} · Semana {progress.week_number}
              </p>
            )}
          </div>
        </div>

        {/* Barra de progresso para o próximo nível */}
        {progress && progress.level !== 'avancado' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-semibold">Progresso para o próximo nível</span>
              <span className="text-muted-foreground">
                {progress.sessions_at_current_level} de 6 sessões
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min((progress.sessions_at_current_level / 6) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Empty state */}
        {workouts.length === 0 && (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm space-y-2">
            <p className="font-bold">Nenhum treino concluído ainda</p>
            <p className="text-sm text-muted-foreground">
              Complete seu primeiro treino de {SKILL_NAMES[skillId]} para ver o histórico aqui.
            </p>
          </div>
        )}

        {/* Histórico agrupado por semana */}
        {weeks.map(week => {
          const weekWorkouts = byWeek[week]
          const levelChange = levelHistory.find(l => l.week_number === week)

          return (
            <div key={week} className="space-y-3">

              {/* Cabeçalho da semana */}
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                  Semana {week}
                </p>
                {levelChange && (
                  <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                    <Trophy className="w-3 h-3" />
                    Avançou para {LEVEL_LABELS[levelChange.to_level]}!
                  </span>
                )}
              </div>

              {/* Cards de treino */}
              {weekWorkouts.map(workout => (
                <div key={workout.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">

                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-extrabold">{formatDate(workout.date)}</p>
                        {workout.is_redo && (
                          <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            Repetição
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {workout.items.length} exercícios
                      </p>
                    </div>
                    <button
                      onClick={() => router.push(`/treino-skill/${workout.id}?clone=true`)}
                      className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                    >
                      Refazer
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="divide-y divide-border">
                    {workout.items.map((item, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{item.exercise_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {item.sets} séries · meta:{' '}
                            {item.time_sec ? `${item.time_sec}s` : `${item.reps} reps`}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          {item.reps_achieved !== null && (
                            <p className="text-xs font-bold text-primary">{item.reps_achieved} reps</p>
                          )}
                          {item.time_achieved_sec !== null && (
                            <p className="text-xs font-bold text-primary">{item.time_achieved_sec}s</p>
                          )}
                          {item.perceived_effort !== null && (
                            <p className={cn('text-[10px]', EFFORT_COLORS[item.perceived_effort])}>
                              {EFFORT_LABELS[item.perceived_effort]}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              ))}

            </div>
          )
        })}

      </div>
    </div>
  )
}
