'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Session, SessionItem, Exercise } from '@/types/database'
import { ChevronLeft, ChevronRight, Timer } from 'lucide-react'
import { evaluateAchievements } from '@/lib/achievements'

type ItemWithExercise = SessionItem & { exercise: Exercise }

type WorkoutState = 'idle' | 'active' | 'rest' | 'done'

export default function TreinoPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()

  const [session, setSession] = useState<Session | null>(null)
  const [items, setItems] = useState<ItemWithExercise[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [state, setState] = useState<WorkoutState>('idle')
  const [timer, setTimer] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  useEffect(() => {
    const nav = document.querySelector('nav')
    if (nav) nav.style.display = 'none'
    return () => {
      if (nav) nav.style.display = ''
    }
  }, [])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      const { data: itemsData } = await supabase
        .from('session_items')
        .select('*, exercise:exercises(*)')
        .eq('session_id', sessionId)
        .order('order_index')

      setSession(sessionData)
      setItems((itemsData ?? []) as ItemWithExercise[])
      setLoading(false)
    }
    load()
  }, [sessionId])

  // Cronômetro regressivo para exercícios por tempo
  useEffect(() => {
        if (state !== 'active' && state !== 'rest') return
        if (timer <= 0) return

        const timeout = setTimeout(() => {
            if (timer === 1 && state === 'rest') {
            setState('active')
            setTimer(0)
            } else {
            setTimer(t => t - 1)
            }
        }, 1000)

        return () => clearTimeout(timeout)
    }, [state, timer])

  const currentItem = items[currentIndex]
  const isLastItem = currentIndex === items.length - 1
  const isTimeBased = currentItem?.time_sec != null

  function handleStart() {
    setState('active')
    if (isTimeBased && currentItem.time_sec) {
      setTimer(currentItem.time_sec)
    }
  }

  function handleNext() {
    if (isLastItem) {
      handleFinish()
      return
    }
    // Descanso de 15s entre exercícios
    setState('rest')
    setTimer(15)
    setCurrentIndex(i => i + 1)
  }

  function handlePrev() {
    if (currentIndex === 0) return
    setState('idle')
    setCurrentIndex(i => i - 1)
  }

  async function handleFinish() {
    if (saving) return
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !session) return

    // Registra treino concluído
    await supabase.from('workouts_completed').insert({
      user_id: user.id,
      session_id: sessionId,
    })

    const newAchievements = await evaluateAchievements(supabase, user.id, sessionId as string)

    if (newAchievements.length > 0) {
      sessionStorage.setItem('new_achievements', JSON.stringify(newAchievements))
    } else {
      sessionStorage.removeItem('new_achievements')
    }

    // Atualiza progresso — adiciona sessão à lista e avança o dia
    const { data: progress } = await supabase
      .from('user_protocol_progress')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (progress) {
      const completedIds = [...(progress.completed_session_ids ?? []), sessionId]
      const nextDay = progress.current_day_number + 1

      // Verifica se completou a fase (7 sessões)
      const phaseNumber = parseInt(progress.current_phase_id.split('-').pop() ?? '1')
      const protocolId = progress.active_protocol_id
      const completedInPhase = completedIds.filter(
        id => id.startsWith(`${protocolId}-${phaseNumber}`)
      ).length

      let nextPhaseId = progress.current_phase_id
      let nextDayNumber = nextDay

      if (completedInPhase >= 7 && phaseNumber < 4) {
        nextPhaseId = `${protocolId}-${phaseNumber + 1}`
        nextDayNumber = 1
      } else if (nextDay > 7) {
        nextDayNumber = 7
      }

      await supabase
        .from('user_protocol_progress')
        .update({
          completed_session_ids: completedIds,
          current_day_number: nextDayNumber,
          current_phase_id: nextPhaseId,
          last_session_completed_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
    }

    router.push(`/treinos/${sessionId}/conclusao`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session || !currentItem) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div className="space-y-3">
          <p className="text-muted-foreground">Treino não encontrado</p>
          <Button onClick={() => router.push('/home')}>Voltar</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto px-4">

      {/* Header */}
      <div className="pt-10 pb-4 flex items-center justify-between">
        <button
          onClick={() => router.push('/home')}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕ Sair
        </button>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {items.length}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="h-1 bg-muted rounded-full mb-8">
        <div
          className="h-full bg-foreground rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
        />
      </div>

      {/* Exercício atual */}
      <div className="flex-1 flex flex-col">

        <div className="space-y-1 mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            {currentItem.exercise?.category}
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            {currentItem.exercise?.name}
          </h2>
        </div>

        {/* Detalhes do exercício */}
        <div className="bg-muted rounded-2xl p-6 mb-6 space-y-4">
          <div className="flex justify-around">
            <div className="text-center">
              <p className="text-3xl font-bold tabular-nums">
                {currentItem.sets}
              </p>
              <p className="text-xs text-muted-foreground mt-1">séries</p>
            </div>
            <div className="w-px bg-border" />
            <div className="text-center">
              <p className="text-3xl font-bold tabular-nums">
                {currentItem.reps != null
                  ? currentItem.reps
                  : currentItem.time_sec}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {currentItem.reps != null ? 'reps' : 'segundos'}
              </p>
            </div>
          </div>

          {currentItem.note && (
            <p className="text-sm text-muted-foreground text-center border-t border-border pt-4">
              💡 {currentItem.note}
            </p>
          )}
        </div>

        {/* Cronômetro / Estado */}
        {state === 'active' && isTimeBased && (
          <div className="text-center mb-6">
            <p className="text-6xl font-bold tabular-nums">{timer}s</p>
            <p className="text-sm text-muted-foreground mt-1">restando</p>
          </div>
        )}

        {state === 'rest' && (
          <div className="text-center mb-6 space-y-1">
            <div className="flex items-center justify-center gap-2">
              <Timer className="w-5 h-5 text-muted-foreground" />
              <p className="text-4xl font-bold tabular-nums">{timer}s</p>
            </div>
            <p className="text-sm text-muted-foreground">Descansando...</p>
          </div>
        )}

      </div>

      {/* Navegação */}
      <div className="pb-10 space-y-3">
        {state === 'idle' && (
          <Button className="w-full h-12 text-base" onClick={handleStart}>
            {isTimeBased ? 'Iniciar cronômetro' : 'Marcar como feito'}
          </Button>
        )}

        {state === 'active' && (
          <Button className="w-full h-12 text-base" onClick={handleNext}>
            {isLastItem ? 'Concluir treino 🎉' : 'Próximo exercício →'}
          </Button>
        )}

        {state === 'rest' && (
          <Button
            variant="outline"
            className="w-full h-12"
            onClick={() => { setState('idle'); setTimer(0) }}
          >
            Pular descanso
          </Button>
        )}

        <div className="flex gap-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={cn(
              "flex-1 h-10 rounded-xl border text-sm flex items-center justify-center gap-1 transition-colors",
              currentIndex === 0
                ? "opacity-30 cursor-not-allowed"
                : "hover:bg-muted"
            )}
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <button
            onClick={handleNext}
            className="flex-1 h-10 rounded-xl border text-sm flex items-center justify-center gap-1 hover:bg-muted transition-colors"
          >
            Pular <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  )
}