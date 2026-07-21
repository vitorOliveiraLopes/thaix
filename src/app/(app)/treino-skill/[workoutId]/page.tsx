'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cloneWorkout, type GeneratedWorkout } from '@/lib/workout-generator'
import { ArrowLeft, ChevronRight, ChevronLeft, CheckCircle, Play, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type ExerciseResult = {
  skill_exercise_id: string
  reps_achieved?: number
  time_achieved_sec?: number
  perceived_effort: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EFFORT_LABELS = ['', 'Muito fácil', 'Fácil', 'Na medida', 'Difícil', 'Muito difícil']
const EFFORT_COLORS = [
  '', 'text-green-500', 'text-green-400',
  'text-yellow-500', 'text-orange-500', 'text-red-500',
]

// ─── TimerDisplay ─────────────────────────────────────────────────────────────

function TimerDisplay({
  targetSec,
  totalSets,
  onComplete,
}: {
  targetSec: number
  totalSets: number
  onComplete: (sec: number) => void
}) {
  const [currentSet, setCurrentSet] = useState(1)
  const [running, setRunning]       = useState(false)
  const [elapsed, setElapsed]       = useState(0)
  const [bestTime, setBestTime]     = useState<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  function clearTimer() {
    clearInterval(intervalRef.current!)
    intervalRef.current = null
  }

  function start() {
    setRunning(true)
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1
        if (next >= targetSec) {
          clearTimer()
          setRunning(false)
          // Série completa — registrar automaticamente
          setBestTime(t => (t === null || next > t) ? next : t)
          setTimeout(() => onComplete(next), 0)
        }
        return next
      })
    }, 1000)
  }

  function stop() {
    clearTimer()
    setRunning(false)
    const achieved = elapsed
    setBestTime(t => (t === null || achieved > t) ? achieved : t)
    setTimeout(() => onComplete(achieved), 0)
  }

  function resetAndNextSet() {
    clearTimer()
    setRunning(false)
    setElapsed(0)
    if (currentSet < totalSets) setCurrentSet(s => s + 1)
  }

  useEffect(() => () => clearTimer(), [])

  const pad = (n: number) => String(n).padStart(2, '0')
  const pct = Math.min((elapsed / targetSec) * 100, 100)
  const isDone = elapsed > 0 && !running

  return (
    <div className="bg-foreground rounded-2xl p-5 text-center space-y-4">
      {/* Indicador de série */}
      {totalSets > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalSets }, (_, i) => (
            <div
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                i + 1 < currentSet
                  ? 'bg-primary'
                  : i + 1 === currentSet
                  ? 'bg-white'
                  : 'bg-white/20'
              )}
            />
          ))}
        </div>
      )}

      {/* Timer */}
      <div className="text-5xl font-extrabold text-white tabular-nums">
        {pad(Math.floor(elapsed / 60))}:{pad(elapsed % 60)}
        <span className="text-white/40 text-2xl">
          {' '}/ {Math.floor(targetSec / 60)}:{pad(targetSec % 60)}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Melhor tempo da sessão */}
      {bestTime !== null && (
        <p className="text-xs text-white/50">
          Melhor tempo: {pad(Math.floor(bestTime / 60))}:{pad(bestTime % 60)}
        </p>
      )}

      {/* Botões */}
      {!running && elapsed === 0 && (
        <button
          onClick={start}
          className="w-full h-12 bg-primary text-white font-bold rounded-full flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4" />
          {currentSet > 1 ? `Série ${currentSet} — Iniciar` : 'Iniciar'}
        </button>
      )}

      {running && (
        <button
          onClick={stop}
          className="w-full h-12 bg-white/10 text-white font-bold rounded-full"
        >
          Parar e registrar
        </button>
      )}

      {isDone && (
        <div className="flex gap-2">
          {currentSet < totalSets && (
            <button
              onClick={resetAndNextSet}
              className="flex-1 h-12 bg-white/10 text-white font-bold rounded-full"
            >
              Próxima série →
            </button>
          )}
          <button
            onClick={() => { setElapsed(0); setBestTime(null) }}
            className={cn(
              'h-12 text-white/70 font-medium rounded-full border border-white/20',
              currentSet < totalSets ? 'px-4 text-sm' : 'flex-1'
            )}
          >
            Refazer
          </button>
        </div>
      )}
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

  // Resultado indexado pelo par (skill_exercise_id + order_index) para suportar
  // exercícios repetidos no mesmo treino sem colisão de chave
  const resultKey    = `${currentItem.skill_exercise_id}-${currentIndex}`
  const currentResult = results[resultKey]

  // Botão "Próximo" só aparece quando reps/tempo E esforço estão registrados
  const canAdvance =
    currentResult?.perceived_effort !== undefined &&
    (currentResult?.reps_achieved !== undefined ||
      currentResult?.time_achieved_sec !== undefined)

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function setResult(partial: Partial<ExerciseResult>) {
    setResults(prev => {
      const existing = prev[resultKey]
      return {
        ...prev,
        [resultKey]: {
          skill_exercise_id: currentItem.skill_exercise_id,
          perceived_effort:  existing?.perceived_effort ?? 3,
          reps_achieved:     existing?.reps_achieved,
          time_achieved_sec: existing?.time_achieved_sec,
          ...partial,
        } as ExerciseResult,
      }
    })
  }

  function handleNext() {
    if (!isLast) setCurrentIndex(i => i + 1)
    else setDone(true)
  }

  async function handleFinish() {
    if (!workout) return
    setSaving(true)

    // Converter results de volta para array usando skill_exercise_id
    const resultValues = Object.values(results).reduce<Record<string, ExerciseResult>>(
      (acc, r) => {
        // Se houver duplicatas, manter o resultado com maior perceived_effort
        const existing = acc[r.skill_exercise_id]
        if (!existing || r.perceived_effort > existing.perceived_effort) {
          acc[r.skill_exercise_id] = r
        }
        return acc
      },
      {}
    )

    try {
      const res = await fetch('/api/workouts/complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          workoutId: activeWorkoutId,
          results:   Object.values(resultValues),
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
            return (
              <div
                key={key}
                className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm"
              >
                <p className="text-sm font-medium">{item.exercise.exercise_name}</p>
                <div className="text-right">
                  {r?.reps_achieved !== undefined && (
                    <p className="text-xs text-primary font-bold">{r.reps_achieved} reps</p>
                  )}
                  {r?.time_achieved_sec !== undefined && (
                    <p className="text-xs text-primary font-bold">{r.time_achieved_sec}s</p>
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

        {/* Info do exercício */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
          <p className="text-xs font-bold tracking-widest text-primary uppercase">
            {currentItem.exercise.category}
          </p>
          <h2 className="text-xl font-extrabold">{currentItem.exercise.exercise_name}</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{currentItem.sets} séries</span>
            <span>·</span>
            {isTimeBased ? (
              <span className="flex items-center gap-1">
                <Timer className="w-3.5 h-3.5" />
                {currentItem.time_sec}s
              </span>
            ) : (
              <span>{currentItem.reps} reps</span>
            )}
          </div>
          {currentItem.exercise.note && (
            <p className="text-xs text-muted-foreground border-t border-border pt-2">
              💡 {currentItem.exercise.note}
            </p>
          )}
        </div>

        {/* Registro de resultado */}
        {isTimeBased ? (
          <TimerDisplay
            key={`timer-${currentIndex}`}
            targetSec={currentItem.time_sec!}
            totalSets={currentItem.sets}
            onComplete={sec => setResult({ time_achieved_sec: sec })}
          />
        ) : (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-sm font-bold">Quantas reps você fez?</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setResult({
                    reps_achieved: Math.max(
                      0,
                      (currentResult?.reps_achieved ?? currentItem.reps ?? 0) - 1
                    ),
                  })
                }
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl font-bold"
              >
                −
              </button>
              <span className="flex-1 text-center text-3xl font-extrabold tabular-nums text-primary">
                {currentResult?.reps_achieved ?? currentItem.reps ?? 0}
              </span>
              <button
                onClick={() =>
                  setResult({
                    reps_achieved:
                      (currentResult?.reps_achieved ?? currentItem.reps ?? 0) + 1,
                  })
                }
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl font-bold"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Esforço percebido — aparece após registrar reps ou tempo */}
        {(currentResult?.reps_achieved !== undefined ||
          currentResult?.time_achieved_sec !== undefined) && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-sm font-bold">Como foi?</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setResult({ perceived_effort: n })}
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

      {/* Navegação — botão só aparece quando reps/tempo E esforço estão preenchidos */}
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
