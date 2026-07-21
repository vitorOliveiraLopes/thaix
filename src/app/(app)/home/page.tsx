'use client'

import { useRouter } from 'next/navigation'
import { useHomeData } from '@/hooks/useHomeData'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Flame, Droplets, X, Pencil } from 'lucide-react'
import { useState, useEffect } from 'react'
import { PegaLeveModal } from '@/components/app/PegaLeveModal'
import { SkillWorkouts } from '@/components/app/SkillWorkouts'

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

const HYDRATION_OPTIONS = [1000, 1500, 2000, 2500, 3000, 3500]

function formatMl(ml: number) {
  return ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`
}

export default function HomePage() {
  const router = useRouter()
  const {
    profile,
    hydrationToday,
    streakCount,
    loading,
    error,
  } = useHomeData()

  const [hydration, setHydration] = useState<boolean | null>(null)
  const hydrationValue = hydration ?? hydrationToday

  const [showPegaLeve, setShowPegaLeve] = useState(false)
  const [painToday, setPainToday] = useState<number | null>(null)

  const [hydrationGoal, setHydrationGoal] = useState(2000)
  const [showHydrationModal, setShowHydrationModal] = useState(false)
  const [savingGoal, setSavingGoal] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('daily_pain_logs')
        .select('pain_score')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle()
      if (data) setPainToday(data.pain_score)
    }
    load()
  }, [])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('hydration_goal_ml')
        .eq('user_id', user.id)
        .single()
      if (data?.hydration_goal_ml) setHydrationGoal(data.hydration_goal_ml)
    }
    load()
  }, [])

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

  async function handleSaveHydrationGoal(ml: number) {
    setSavingGoal(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ hydration_goal_ml: ml }).eq('user_id', user.id)
    setHydrationGoal(ml)
    setSavingGoal(false)
    setShowHydrationModal(false)
  }

  const coachPhrase = COACH_PHRASES[new Date().getDay() % COACH_PHRASES.length]

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
          <h1 className="text-2xl font-extrabold tracking-tight">
            {getGreeting(profile?.name ?? null)} 👋
          </h1>
          <p className="text-sm text-muted-foreground">{coachPhrase}</p>
        </div>

        {/* Streak + Hidratação + Dor */}
        <div className="grid grid-cols-3 gap-3">

          {/* Streak */}
          <div className="bg-white rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
              <Flame className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{streakCount}</p>
              <p className="text-xs text-muted-foreground">
                {streakCount === 1 ? 'dia seguido' : 'dias'}
              </p>
            </div>
          </div>

          {/* Hidratação */}
          <div className={cn(
            'rounded-2xl p-4 flex flex-col gap-2 shadow-sm relative',
            hydrationValue ? 'bg-primary/10' : 'bg-white'
          )}>
            {/* Botão de editar meta — canto superior direito */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowHydrationModal(true) }}
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
            >
              <Pencil className="w-3 h-3 text-muted-foreground" />
            </button>
            {/* Card inteiro marca/desmarca a meta */}
            <button
              onClick={handleToggleHydration}
              className="flex flex-col gap-2 text-left w-full"
            >
              <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <Droplets className={cn('w-4 h-4', hydrationValue ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {hydrationValue ? 'Meta ✓' : 'Água'}
                </p>
                <p className="text-sm font-bold">{formatMl(hydrationGoal)}</p>
              </div>
            </button>
          </div>

          {/* Esforço */}
          <button
            onClick={() => setShowPegaLeve(true)}
            className="bg-white rounded-2xl p-4 flex flex-col gap-2 text-left hover:bg-muted/50 transition-colors shadow-sm"
          >
            <div className="w-8 h-8 bg-muted rounded-xl flex items-center justify-center">
              <span className="text-base">
                {painToday !== null ? PAIN_LABELS[painToday].emoji : '💪'}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Esforço</p>
              <p className="text-sm font-bold">
                {painToday !== null ? `${painToday}/10` : 'Registrar'}
              </p>
            </div>
          </button>

        </div>

        {/* Treinos do dia por skill */}
        <SkillWorkouts />

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

      {/* Modal meta de hidratação */}
      {showHydrationModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-end pb-16">
          <div className="w-full max-w-md mx-auto bg-background border border-border rounded-t-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg">Meta de hidratação</h3>
                <p className="text-sm text-muted-foreground">Escolha sua meta diária de água</p>
              </div>
              <button onClick={() => setShowHydrationModal(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {HYDRATION_OPTIONS.map(ml => (
                <button
                  key={ml}
                  onClick={() => handleSaveHydrationGoal(ml)}
                  disabled={savingGoal}
                  className={cn(
                    'py-4 rounded-2xl border text-center transition-all',
                    hydrationGoal === ml
                      ? 'bg-primary border-primary text-white'
                      : 'bg-white border-border hover:border-primary/40'
                  )}
                >
                  <span className="block text-lg font-extrabold">{formatMl(ml)}</span>
                  <span className="text-xs opacity-70">{ml}ml</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Recomendação: entre 2L e 3L por dia para atletas.
            </p>
          </div>
        </div>
      )}

    </div>
  )
}