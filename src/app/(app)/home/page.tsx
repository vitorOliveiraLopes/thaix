'use client'

import { useRouter } from 'next/navigation'
import { useHomeData } from '@/hooks/useHomeData'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Flame, Droplets } from 'lucide-react'
import { useState } from 'react'
import { PegaLeveModal } from '@/components/app/PegaLeveModal'

function getGreeting(name: string | null): string {
  const hour = new Date().getHours()
  const first = name?.split(' ')[0] ?? ''
  if (hour < 12) return `Bom dia${first ? `, ${first}` : ''}`
  if (hour < 18) return `Boa tarde${first ? `, ${first}` : ''}`
  return `Boa noite${first ? `, ${first}` : ''}`
}

const COACH_PHRASES = [
  'Sem pressa, foco na qualidade do movimento.',
  'Hoje é mais um passo. Cada dia conta.',
  'Lembre-se: respirar bem é metade do trabalho.',
  'Você está construindo um corpo forte e duradouro.',
  'Movimento certo, todo dia. É assim que se evolui.',
]

const PAIN_LABELS: Record<number, { emoji: string }> = {
  0: { emoji: '😄' }, 1: { emoji: '🙂' }, 2: { emoji: '😊' },
  3: { emoji: '😐' }, 4: { emoji: '😕' }, 5: { emoji: '😣' },
  6: { emoji: '😖' }, 7: { emoji: '😫' }, 8: { emoji: '😤' },
  9: { emoji: '🤯' }, 10: { emoji: '💀' },
}

export default function HomePage() {
  const router = useRouter()
  const {
    profile,
    progress,
    todaySession,
    sessionItems,
    hydrationToday,
    streakCount,
    loading,
    error,
  } = useHomeData()

  const [hydration, setHydration] = useState<boolean | null>(null)
  const hydrationValue = hydration ?? hydrationToday
  const [showPegaLeve, setShowPegaLeve] = useState(false)
  const [painToday, setPainToday] = useState<number | null>(null)

  async function handleToggleHydration() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]
    const newValue = !hydrationValue

    setHydration(newValue)

    const { error } = await supabase
      .from('hydration_days')
      .upsert(
        { user_id: user.id, date: today, met_goal: newValue },
        { onConflict: 'user_id,date' }
      )

    if (error) setHydration(!newValue)
  }

  const coachPhrase = COACH_PHRASES[new Date().getDay() % COACH_PHRASES.length]
  const phaseNumber = progress?.current_phase_id?.split('-').pop() ?? '1'
  const completedInPhase = progress?.completed_session_ids?.filter(
    id => id.startsWith(`${progress.active_protocol_id}-${phaseNumber}`)
  ).length ?? 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div className="space-y-3">
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => router.push('/login')}>Fazer login</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto px-4 pt-10 space-y-6">

        {/* Saudação */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {getGreeting(profile?.name ?? null)} 👋
          </h1>
          <p className="text-sm text-muted-foreground">{coachPhrase}</p>
        </div>

        {/* Streak + Hidratação + PegaLeve */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted rounded-2xl p-4 flex flex-col gap-2">
            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{streakCount}</p>
              <p className="text-xs text-muted-foreground">
                {streakCount === 1 ? 'dia seguido' : 'dias'}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleHydration}
            className={cn(
              "rounded-2xl p-4 flex flex-col gap-2 transition-all text-left",
              hydrationValue
                ? "bg-blue-100 dark:bg-blue-900/30"
                : "bg-muted"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center",
              hydrationValue
                ? "bg-blue-200 dark:bg-blue-800/50"
                : "bg-background"
            )}>
              <Droplets className={cn(
                "w-4 h-4",
                hydrationValue ? "text-blue-500" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <p className="text-sm font-medium">
                {hydrationValue ? 'Hidratado!' : 'Água'}
              </p>
              <p className="text-xs text-muted-foreground">
                {hydrationValue ? 'Meta ✓' : 'Marcar'}
              </p>
            </div>
          </button>

          <button
            onClick={() => setShowPegaLeve(true)}
            className="bg-muted rounded-2xl p-4 flex flex-col gap-2 text-left hover:bg-muted/80 transition-colors"
          >
            <div className="w-8 h-8 bg-background rounded-xl flex items-center justify-center">
              <span className="text-base">
                {painToday !== null ? PAIN_LABELS[painToday].emoji : '💪'}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium">Dor</p>
              <p className="text-xs text-muted-foreground">
                {painToday !== null ? `${painToday}/10` : 'Registrar'}
              </p>
            </div>
          </button>
        </div>

        {/* Progresso da fase */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium capitalize">
              {progress?.active_protocol_id} — Fase {phaseNumber}
            </span>
            <span className="text-muted-foreground">
              {completedInPhase} de 7 sessões
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground rounded-full transition-all"
              style={{ width: `${(completedInPhase / 7) * 100}%` }}
            />
          </div>
        </div>

        {/* Treino do dia */}
        {todaySession ? (
          <div className="border rounded-2xl overflow-hidden">
            <div className="bg-muted px-5 py-4">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                Treino do dia
              </p>
              <h2 className="text-lg font-semibold">{todaySession.title}</h2>
              <p className="text-sm text-muted-foreground">
                ~{todaySession.estimated_minutes} min · {sessionItems.length} exercícios
              </p>
            </div>

            <div className="divide-y divide-border">
              {sessionItems.slice(0, 4).map((item) => (
                <div key={item.id} className="px-5 py-3 flex justify-between items-center">
                  <span className="text-sm font-medium">{item.exercise?.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {item.sets}×{item.reps != null
                      ? `${item.reps} reps`
                      : `${item.time_sec}s`}
                  </span>
                </div>
              ))}
              {sessionItems.length > 4 && (
                <div className="px-5 py-3">
                  <span className="text-sm text-muted-foreground">
                    +{sessionItems.length - 4} exercícios
                  </span>
                </div>
              )}
            </div>

            <div className="px-5 py-4">
              <Button
                className="w-full h-11"
                onClick={() => router.push(`/treinos/${todaySession.id}`)}
              >
                Iniciar treino
              </Button>
            </div>
          </div>
        ) : (
          <div className="border rounded-2xl p-6 text-center space-y-2">
            <p className="font-medium">Nenhum treino para hoje</p>
            <p className="text-sm text-muted-foreground">
              Você completou todas as sessões desta fase!
            </p>
          </div>
        )}

      </div>

      {/* Modal PegaLeve */}
      {showPegaLeve && (
        <PegaLeveModal
          onClose={() => setShowPegaLeve(false)}
          onSaved={(score) => {
            setPainToday(score)
            setShowPegaLeve(false)
          }}
        />
      )}

    </div>
  )
}