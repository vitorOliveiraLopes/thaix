'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateDailyWorkouts, type GeneratedWorkout } from '@/lib/workout-generator'
import { ChevronRight, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type RestDayState = {
  isRestDay: boolean
  trainingDays: number[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SKILL_NAMES: Record<string, string> = {
  'pull-up': 'Pull-up',
  'c2b':     'Chest to Bar',
  'bmu':     'Bar Muscle-up',
  't2b':     'Toes-to-Bar',
  'hspu':    'HSPU',
}

const SKILL_ICONS: Record<string, string> = {
  'pull-up': '🏋️',
  'c2b':     '💥',
  'bmu':     '🥇',
  't2b':     '✨',
  'hspu':    '🤸',
}

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ─── RestDayCard ──────────────────────────────────────────────────────────────

function RestDayCard({
  trainingDays,
  onTrainAnyway,
  loading,
}: {
  trainingDays: number[]
  onTrainAnyway: () => void
  loading: boolean
}) {
  const nextTrainingDay = (() => {
    const todayDow = new Date().getDay()
    const sorted = [...trainingDays].sort((a, b) => a - b)
    const next = sorted.find(d => d > todayDow) ?? sorted[0]
    return WEEKDAY_NAMES[next]
  })()

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          Hoje
        </p>
        <h3 className="text-lg font-extrabold">Dia de recuperação 🧘</h3>
        <p className="text-sm text-muted-foreground leading-snug">
          O descanso é parte do treino. Seu próximo dia de skill é{' '}
          <span className="font-semibold text-foreground">{nextTrainingDay}</span>.
        </p>
      </div>
      <div className="bg-muted rounded-xl p-3 space-y-1.5">
        {[
          '💤 Priorize 7–9h de sono',
          '💧 Continue com sua meta de hidratação',
          '🚶 Caminhada leve ou mobilidade são bem-vindas',
        ].map(tip => (
          <p key={tip} className="text-xs text-muted-foreground">{tip}</p>
        ))}
      </div>
      <button
        onClick={onTrainAnyway}
        disabled={loading}
        className={cn(
          'w-full h-10 rounded-full border border-border text-sm font-medium',
          'text-muted-foreground hover:text-foreground hover:border-foreground/30',
          'transition-colors disabled:opacity-40'
        )}
      >
        {loading ? 'Gerando treino...' : 'Treinar mesmo assim →'}
      </button>
    </div>
  )
}

// ─── HighEffortBanner ────────────────────────────────────────────────────────

function HighEffortBanner({ avgEffort }: { avgEffort: number }) {
  const isHigh = avgEffort >= 4
  return (
    <div className={cn(
      'rounded-2xl px-4 py-3 flex items-start gap-3',
      isHigh ? 'bg-orange-50 border border-orange-200' : 'bg-amber-50 border border-amber-200'
    )}>
      <span className="text-xl shrink-0 mt-0.5">{isHigh ? '🔥' : '⚡'}</span>
      <div className="space-y-0.5">
        <p className="text-sm font-bold text-foreground">
          {isHigh ? 'Seu corpo está trabalhando muito' : 'Semana intensa'}
        </p>
        <p className="text-xs text-muted-foreground leading-snug">
          {isHigh
            ? 'Priorizamos exercícios de recuperação hoje. Hidratação e sono fazem parte do treino.'
            : 'O treino de hoje foi ajustado para equilibrar esforço e recuperação.'}
        </p>
      </div>
    </div>
  )
}

// ─── WorkoutCard — treino disponível ─────────────────────────────────────────

function WorkoutCard({
  workout,
  onStart,
  isRestDay,
}: {
  workout: GeneratedWorkout
  onStart: () => void
  isRestDay: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const PREVIEW = 4
  const hasMore = workout.items.length > PREVIEW
  const visible = expanded ? workout.items : workout.items.slice(0, PREVIEW)

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{SKILL_ICONS[workout.skill_id]}</span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-primary uppercase tracking-widest">
                  Treino do dia
                </p>
                {isRestDay && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                    Extra
                  </span>
                )}
              </div>
              <h3 className="font-extrabold">{SKILL_NAMES[workout.skill_id]}</h3>
            </div>
          </div>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-medium">
            Semana {workout.week_number}
          </span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {visible.map((item, idx) => (
          <div
            key={`${item.skill_exercise_id}-${idx}`}
            className="px-5 py-2.5 flex justify-between items-center"
          >
            <span className="text-sm font-medium">{item.exercise.exercise_name}</span>
            <span className="text-xs text-muted-foreground">
              {item.sets}×{item.time_sec ? `${item.time_sec}s` : `${item.reps} reps`}
            </span>
          </div>
        ))}
        {hasMore && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full px-5 py-2.5 text-left text-xs font-bold text-primary hover:bg-primary/5 transition-colors"
          >
            {expanded
              ? '↑ Ver menos'
              : `↓ +${workout.items.length - PREVIEW} exercícios`}
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        <button
          onClick={onStart}
          className="w-full h-12 bg-primary text-white font-bold rounded-full hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          Iniciar treino
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── CompletedWorkoutCard — treino já concluído ───────────────────────────────
//
// Versão compacta exibida abaixo dos treinos pendentes.
// Informa que o treino foi feito sem ocupar destaque na tela.

function CompletedWorkoutCard({ workout }: { workout: GeneratedWorkout }) {
  return (
    <div className="bg-white rounded-2xl px-5 py-4 shadow-sm flex items-center gap-3 opacity-70">
      <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center shrink-0">
        <CheckCircle className="w-5 h-5 text-green-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">
          {SKILL_ICONS[workout.skill_id]} {SKILL_NAMES[workout.skill_id]}
        </p>
        <p className="text-xs text-muted-foreground">
          Treino concluído hoje · {workout.items.length} exercícios
        </p>
      </div>
    </div>
  )
}

// ─── AllDoneCard — todos os treinos do dia concluídos ─────────────────────────

function AllDoneCard() {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-2">
      <p className="text-3xl">🎉</p>
      <p className="font-extrabold">Dia completo!</p>
      <p className="text-sm text-muted-foreground leading-snug">
        Você concluiu todos os treinos de hoje. Descanse bem, hidrate-se e volte amanhã mais forte.
      </p>
    </div>
  )
}

// ─── SkillWorkouts ────────────────────────────────────────────────────────────

export function SkillWorkouts() {
  const router = useRouter()
  const [workouts, setWorkouts] = useState<GeneratedWorkout[]>([])
  const [restDay, setRestDay] = useState<RestDayState | null>(null)
  const [recentAvgEffort, setRecentAvgEffort] = useState<number | null>(null)
  const [loadingWorkout, setLoadingWorkout] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const todayDow = new Date().getDay()

      const { data: onb } = await supabase
        .from('onboarding_responses')
        .select('dias_semana')
        .eq('user_id', user.id)
        .maybeSingle()

      const trainingDays: number[] = onb?.dias_semana ?? []
      const isRestDay = trainingDays.length > 0 && !trainingDays.includes(todayDow)

      // Esforço médio recente para o banner adaptativo
      const { data: recentWorkouts } = await supabase
        .from('daily_workouts')
        .select('id')
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .order('date', { ascending: false })
        .limit(3)

      if ((recentWorkouts ?? []).length > 0) {
        const recentIds = recentWorkouts!.map(w => w.id)
        const { data: recentResults } = await supabase
          .from('daily_workout_results')
          .select('perceived_effort')
          .in('daily_workout_id', recentIds)

        const efforts = (recentResults ?? [])
          .map(r => r.perceived_effort ?? 3)
          .filter(e => e > 0)

        if (efforts.length > 0) {
          setRecentAvgEffort(efforts.reduce((a, b) => a + b, 0) / efforts.length)
        }
      }

      if (isRestDay) {
        const today = new Date().toISOString().split('T')[0]
        const { data: existingToday } = await supabase
          .from('daily_workouts')
          .select('id')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle()

        if (existingToday) {
          const generated = await generateDailyWorkouts(user.id)
          setWorkouts(generated)
        } else {
          setRestDay({ isRestDay: true, trainingDays })
        }
      } else {
        const generated = await generateDailyWorkouts(user.id)
        setWorkouts(generated)
      }

      setLoading(false)
    }

    load()
  }, [])

  async function handleTrainAnyway() {
    setLoadingWorkout(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const generated = await generateDailyWorkouts(user.id)
    setWorkouts(generated)
    setRestDay(null)
    setLoadingWorkout(false)
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm animate-pulse space-y-3">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-6 bg-muted rounded w-1/2" />
        <div className="h-10 bg-muted rounded-xl" />
      </div>
    )
  }

  // ─── Dia de descanso ───────────────────────────────────────────────────────

  if (restDay?.isRestDay && workouts.length === 0) {
    return (
      <RestDayCard
        trainingDays={restDay.trainingDays}
        onTrainAnyway={handleTrainAnyway}
        loading={loadingWorkout}
      />
    )
  }

  // ─── Sem treino gerado ────────────────────────────────────────────────────

  if (workouts.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm text-center space-y-2">
        <p className="font-bold">Nenhum treino para hoje</p>
        <p className="text-sm text-muted-foreground">
          Aproveite para descansar e recuperar! 💪
        </p>
      </div>
    )
  }

  // ─── Separar pendentes e concluídos ───────────────────────────────────────

  const pending   = workouts.filter(w => !w.completed_at)
  const completed = workouts.filter(w => !!w.completed_at)
  const allDone   = pending.length === 0

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {recentAvgEffort !== null && recentAvgEffort >= 3.5 && (
        <HighEffortBanner avgEffort={recentAvgEffort} />
      )}

      {/* Treinos pendentes — destaque total */}
      {pending.map(workout => (
        <WorkoutCard
          key={workout.id}
          workout={workout}
          isRestDay={!!restDay?.isRestDay}
          onStart={() => router.push(`/treino-skill/${workout.id}`)}
        />
      ))}

      {/* Todos concluídos — mensagem de parabéns */}
      {allDone && <AllDoneCard />}

      {/* Treinos concluídos — cards compactos abaixo */}
      {completed.length > 0 && (
        <div className="space-y-2">
          {!allDone && (
            <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase px-1">
              Concluídos hoje
            </p>
          )}
          {completed.map(workout => (
            <CompletedWorkoutCard key={workout.id} workout={workout} />
          ))}
        </div>
      )}
    </div>
  )
}
