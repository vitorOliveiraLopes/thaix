'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cloneWorkout, type GeneratedWorkout } from '@/lib/workout-generator'
import { ArrowLeft, ChevronRight, ChevronLeft, CheckCircle, Play, Hourglass, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type SetValues = (number | null)[]

type ExerciseResult = {
  skill_exercise_id: string
  reps_per_set?: SetValues
  time_per_set?: SetValues
  perceived_effort: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EFFORT_LABELS = ['', 'Muito fácil', 'Fácil', 'Na medida', 'Difícil', 'Muito difícil']
const EFFORT_COLORS = [
  '', 'text-green-500', 'text-green-400',
  'text-yellow-500', 'text-orange-500', 'text-red-500',
]

function bestOf(values: SetValues | undefined): number | undefined {
  const valid = (values ?? []).filter((v): v is number => v !== null)
  return valid.length > 0 ? Math.max(...valid) : undefined
}

function filledCount(values: SetValues | undefined): number {
  return (values ?? []).filter(v => v !== null).length
}

// ─── RestInfoCard ─────────────────────────────────────────────────────────────
//
// Informativo, sem timer. Só aparece para exercícios com mais de 1 série.

function RestInfoCard({ restSec }: { restSec: number }) {
  if (!restSec) return null
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-muted rounded-xl">
      <Hourglass className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground">
        Descanso recomendado: {restSec}s entre séries
      </span>
    </div>
  )
}

// ─── RepsMultiSet ─────────────────────────────────────────────────────────────
//
// Layout "compacta" aprovado: uma linha por série, sem meta numérica visível.
// Séries preenchidas continuam com +/- ativos (nunca travam). A série ativa
// é a primeira ainda não preenchida; séries seguintes ficam esmaecidas.

function RepsMultiSet({
  values,
  onChange,
}: {
  values: SetValues
  onChange: (next: SetValues) => void
}) {
  const activeIndex = values.findIndex(v => v === null)
  const hasAnyFilled = values.some(v => v !== null)

  function adjust(index: number, delta: number) {
    const next = [...values]
    const current = next[index] ?? 0
    next[index] = Math.max(0, current + delta)
    onChange(next)
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      <p className="text-sm font-bold">Quantas reps você fez?</p>
      <div className="flex flex-col gap-2">
        {values.map((value, i) => {
          const isFilled = value !== null
          const isActive = i === activeIndex
          const isPending = !isFilled && !isActive

          if (isPending) {
            return (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border opacity-45"
              >
                <span className="text-sm font-medium">Série {i + 1}</span>
                <span className="text-xs text-muted-foreground">aguardando</span>
              </div>
            )
          }

          return (
            <div
              key={i}
              className={cn(
                'flex items-center justify-between px-3 py-2.5 rounded-xl',
                isFilled
                  ? 'border border-border bg-green-50'
                  : 'border-2 border-primary'
              )}
            >
              <span className="text-sm font-medium">Série {i + 1}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjust(i, -1)}
                  className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-sm font-bold"
                >
                  −
                </button>
                <span className="text-base font-bold tabular-nums min-w-[18px] text-center">
                  {value ?? 0}
                </span>
                <button
                  onClick={() => adjust(i, 1)}
                  className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-sm font-bold"
                >
                  +
                </button>
                {isFilled && (
                  <CheckCircle className="w-4 h-4 text-green-500 ml-1" />
                )}
              </div>
            </div>
          )
        })}
      </div>
      {!hasAnyFilled && (
        <p className="text-[11px] text-muted-foreground text-center pt-1">
          Toque + para começar a registrar a série 1
        </p>
      )}
    </div>
  )
}

// ─── TimerMultiSet ────────────────────────────────────────────────────────────
//
// Mesma filosofia da RepsMultiSet, mas para exercícios de tempo. Qualquer
// série já registrada pode ser refeita a qualquer momento — não trava.

function TimerMultiSet({
  targetSec,
  totalSets,
  values,
  onChange,
}: {
  targetSec: number
  totalSets: number
  values: SetValues
  onChange: (next: SetValues) => void
}) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const firstNull = values.findIndex(v => v === null)
  const activeIndex = editingIndex ?? (firstNull === -1 ? totalSets - 1 : firstNull)

  function clearTimer() {
    clearInterval(intervalRef.current!)
    intervalRef.current = null
  }

  function commit(sec: number) {
    const next = [...values]
    next[activeIndex] = sec
    onChange(next)
    setEditingIndex(null)
    setElapsed(0)
    setRunning(false)
  }

  function start() {
    setRunning(true)
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1
        if (next >= targetSec) {
          clearTimer()
          setTimeout(() => commit(next), 0)
        }
        return next
      })
    }, 1000)
  }

  function stop() {
    clearTimer()
    setTimeout(() => commit(elapsed), 0)
  }

  function redoSet(index: number) {
    clearTimer()
    setElapsed(0)
    setRunning(false)
    setEditingIndex(index)
  }

  useEffect(() => () => clearTimer(), [])

  const pad = (n: number) => String(n).padStart(2, '0')
  const pct = Math.min((elapsed / targetSec) * 100, 100)

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
        <p className="text-sm font-bold mb-1">Séries</p>
        <div className="flex flex-col gap-2">
          {values.map((value, i) => {
            const isFilled = value !== null
            const isActive = i === activeIndex

            if (!isFilled && !isActive) {
              return (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border opacity-45"
                >
                  <span className="text-sm font-medium">Série {i + 1}</span>
                  <span className="text-xs text-muted-foreground">aguardando</span>
                </div>
              )
            }

            if (isFilled && !isActive) {
              return (
                <button
                  key={i}
                  onClick={() => redoSet(i)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border bg-green-50 w-full"
                >
                  <span className="text-sm font-medium">Série {i + 1}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold tabular-nums">{value}s</span>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <Pencil className="w-3 h-3 text-muted-foreground" />
                  </div>
                </button>
              )
            }

            return (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl border-2 border-primary"
              >
                <span className="text-sm font-medium">Série {i + 1}</span>
                {isFilled && <span className="text-xs text-muted-foreground">refazendo</span>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-foreground rounded-2xl p-5 text-center space-y-4">
        <div className="text-5xl font-extrabold text-white tabular-nums">
          {pad(Math.floor(elapsed / 60))}:{pad(elapsed % 60)}
          <span className="text-white/40 text-2xl">
            {' '}/ {Math.floor(targetSec / 60)}:{pad(targetSec % 60)}
          </span>
        </div>
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {!running ? (
          <button
            onClick={start}
            className="w-full h-12 bg-primary text-white font-bold rounded-full flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Iniciar série {activeIndex + 1}
          </button>
        ) : (
          <button
            onClick={stop}
            className="w-full h-12 bg-white/10 text-white font-bold rounded-full"
          >
            Parar e registrar
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SkillWorkoutPage() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null)
  const [activeWorkoutId, setActiveWorkoutId] = useState<string>(workoutId)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<Record<string, ExerciseResult>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let targetId = workoutId
      const shouldClone = searchParams.get('clone') === 'true'

      if (shouldClone) {
        const clonedId = await cloneWorkout(user.id, workoutId)
        if (clonedId) {
          targetId = clonedId
          setActiveWorkoutId(clonedId)
        }
      }

      const { data } = await supabase
        .from('daily_workouts')
        .select('*, daily_workout_items(*, skill_exercises(*))')
        .eq('id', targetId)
        .single()

      if (!data) return

      setWorkout({
        id: data.id,
        skill_id: data.skill_id,
        date: data.date,
        week_number: data.week_number,
        completed_at: data.completed_at ?? null,
        items: (data.daily_workout_items as any[])
          .sort((a, b) => a.order_index - b.order_index)
          .map(item => ({
            skill_exercise_id: item.skill_exercise_id,
            order_index:       item.order_index,
            sets:              item.sets,
            reps:              item.reps,
            time_sec:          item.time_sec,
            exercise:          item.skill_exercises,
          })),
      })

      setLoading(false)
    }

    load()
  }, [workoutId, searchParams])

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading || !workout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const currentItem = workout.items[currentIndex]
  const isLast      = currentIndex === workout.items.length - 1
  const isTimeBased = !!currentItem.time_sec
  const totalSets   = currentItem.sets ?? 1

  // Resultado indexado pelo par (skill_exercise_id + order_index) para suportar
  // exercícios repetidos no mesmo treino sem colisão de chave
  const resultKey     = `${currentItem.skill_exercise_id}-${currentIndex}`
  const currentResult = results[resultKey]

  const setValues: SetValues =
    (isTimeBased ? currentResult?.time_per_set : currentResult?.reps_per_set)
    ?? Array(totalSets).fill(null)

  const allSetsFilled = filledCount(setValues) === totalSets
  const anySetFilled  = filledCount(setValues) > 0

  // Botão "Próximo" só aparece quando TODAS as séries E o esforço foram registrados
  const canAdvance =
    currentResult?.perceived_effort !== undefined && allSetsFilled

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function setSetValues(next: SetValues) {
    setResults(prev => {
      const existing = prev[resultKey]
      return {
        ...prev,
        [resultKey]: {
          skill_exercise_id: currentItem.skill_exercise_id,
          perceived_effort:  existing?.perceived_effort ?? 3,
          reps_per_set:       isTimeBased ? existing?.reps_per_set : next,
          time_per_set:       isTimeBased ? next : existing?.time_per_set,
        } as ExerciseResult,
      }
    })
  }

  function setEffort(n: number) {
    setResults(prev => {
      const existing = prev[resultKey]
      return {
        ...prev,
        [resultKey]: {
          skill_exercise_id: currentItem.skill_exercise_id,
          perceived_effort:  n,
          reps_per_set:       existing?.reps_per_set,
          time_per_set:       existing?.time_per_set,
        } as ExerciseResult,
      }
    })
  }

  function handleNext() {
    if (!isLast) setCurrentIndex(i => i + 1)
    else setDone(true)
  }

  function buildPayloadItem(r: ExerciseResult) {
    return {
      skill_exercise_id: r.skill_exercise_id,
      reps_per_set:      r.reps_per_set,
      time_per_set:      r.time_per_set,
      reps_achieved:     bestOf(r.reps_per_set),
      time_achieved_sec: bestOf(r.time_per_set),
      perceived_effort:  r.perceived_effort,
    }
  }

  async function handleFinish() {
    if (!workout) return
    setSaving(true)

    // Converter results de volta para um item por skill_exercise_id.
    // Em caso de exercício repetido, mantém o de maior esforço.
    const bySkillExercise = Object.values(results).reduce<
      Record<string, ReturnType<typeof buildPayloadItem>>
    >((acc, r) => {
      const item = buildPayloadItem(r)
      const existing = acc[r.skill_exercise_id]
      if (!existing || r.perceived_effort > existing.perceived_effort) {
        acc[r.skill_exercise_id] = item
      }
      return acc
    }, {})

    try {
      const res = await fetch('/api/workouts/complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          workoutId: activeWorkoutId,
          results:   Object.values(bySkillExercise),
        }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        console.error('[handleFinish] API error:', payload.error)
      }
    } catch (err) {
      console.error('[handleFinish] Network error:', err)
    }

    router.push('/home')
  }

  // ─── Conclusão ────────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 max-w-sm mx-auto">
        <div className="text-center space-y-4 mb-8">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold">Treino concluído!</h1>
          <p className="text-muted-foreground text-sm">
            {workout.items.length} exercícios completados
          </p>
        </div>

        <div className="w-full space-y-2 mb-8">
          {workout.items.map((item, idx) => {
            const key = `${item.skill_exercise_id}-${idx}`
            const r   = results[key]
            const bestReps = bestOf(r?.reps_per_set)
            const bestTime = bestOf(r?.time_per_set)
            return (
              <div
                key={key}
                className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm"
              >
                <p className="text-sm font-medium">{item.exercise.exercise_name}</p>
                <div className="text-right">
                  {bestReps !== undefined && (
                    <p className="text-xs text-primary font-bold">melhor série: {bestReps} reps</p>
                  )}
                  {bestTime !== undefined && (
                    <p className="text-xs text-primary font-bold">melhor série: {bestTime}s</p>
                  )}
                  {r?.perceived_effort !== undefined && (
                    <p className={cn('text-[10px]', EFFORT_COLORS[r.perceived_effort])}>
                      {EFFORT_LABELS[r.perceived_effort]}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={handleFinish}
          disabled={saving}
          className="w-full h-14 bg-primary text-white font-bold text-base rounded-full hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Salvando...' : 'Finalizar e voltar'}
        </button>
      </div>
    )
  }

  // ─── Execução ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-sm mx-auto pb-24">

      {/* Header */}
      <div className="px-5 pt-10 pb-4 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="text-sm text-muted-foreground font-medium">
          {currentIndex + 1} de {workout.items.length}
        </p>
        <div className="w-5" />
      </div>

      {/* Barra de progresso */}
      <div className="px-5 mb-6">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / workout.items.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col px-5 gap-4">

        {/* Placeholder de vídeo */}
        <div className="w-full aspect-video bg-foreground rounded-2xl flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-white/30">
            <Play className="w-10 h-10" />
            <p className="text-xs">Vídeo em breve</p>
          </div>
        </div>

        {/* Info do exercício — sem meta numérica de reps/tempo, só o essencial */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
          <p className="text-xs font-bold tracking-widest text-primary uppercase">
            {currentItem.exercise.category}
          </p>
          <h2 className="text-xl font-extrabold">{currentItem.exercise.exercise_name}</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{totalSets} série{totalSets > 1 ? 's' : ''}</span>
          </div>
          {currentItem.exercise.note && (
            <p className="text-xs text-muted-foreground border-t border-border pt-2">
              💡 {currentItem.exercise.note}
            </p>
          )}
        </div>

        {/* Registro de resultado */}
        {isTimeBased ? (
          <TimerMultiSet
            key={`timer-${currentIndex}`}
            targetSec={currentItem.time_sec!}
            totalSets={totalSets}
            values={setValues}
            onChange={setSetValues}
          />
        ) : (
          <RepsMultiSet
            values={setValues}
            onChange={setSetValues}
          />
        )}

        {/* Descanso — só para exercícios com mais de 1 série */}
        {totalSets > 1 && <RestInfoCard restSec={currentItem.exercise.rest_sec} />}

        {/* Esforço percebido — aparece assim que ao menos uma série for registrada */}
        {anySetFilled && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-sm font-bold">Como foi?</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setEffort(n)}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-bold border transition-all',
                    currentResult?.perceived_effort === n
                      ? 'bg-primary border-primary text-white'
                      : 'bg-muted border-border text-muted-foreground'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>Muito fácil</span>
              <span>Muito difícil</span>
            </div>
          </div>
        )}

      </div>

      {/* Navegação — botão só aparece quando todas as séries E o esforço estão preenchidos */}
      <div className="px-5 py-6 flex gap-3">
        {currentIndex > 0 && (
          <button
            onClick={() => setCurrentIndex(i => i - 1)}
            className="h-14 px-5 rounded-full border border-border font-medium hover:bg-muted transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
        )}
        {canAdvance && (
          <button
            onClick={handleNext}
            className="flex-1 h-14 bg-primary text-white font-bold rounded-full hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            {isLast ? 'Concluir treino' : 'Próximo'}
            {!isLast && <ChevronRight className="w-4 h-4" />}
          </button>
        )}
      </div>

    </div>
  )
}
