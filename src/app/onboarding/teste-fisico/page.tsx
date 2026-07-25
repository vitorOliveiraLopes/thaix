'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Slider } from '@/components/ui/slider'
import { createClient } from '@/lib/supabase/client'
import { saveTesteFisico, saveCurrentStep, getOnboardingResponses } from '@/lib/onboarding-persist'
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader'
import { CoachBubble } from '@/components/onboarding/CoachBubble'

const EXERCISES = [
  {
    key: 'pushups' as const,
    emoji: '💪',
    label: 'Push-ups strict',
    hint: 'Reps unbroken, com forma limpa.',
    max: 30,
  },
  {
    key: 'pullups' as const,
    emoji: '🏋️',
    label: 'Pull-ups strict',
    hint: 'Reps unbroken, com forma limpa.',
    max: 20,
  },
  {
    key: 'squats' as const,
    emoji: '🦵',
    label: 'Air squats',
    hint: 'Reps unbroken, com forma limpa.',
    max: 50,
  },
]

export default function OnboardingTesteFisico() {
  const router = useRouter()
  const [values, setValues] = useState({ pushups: 0, pullups: 0, squats: 0 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const data = await getOnboardingResponses(user.id)
      if (data) {
        setValues({
          pushups: data.pushups ?? 0,
          pullups: data.pullups ?? 0,
          squats:  data.squats  ?? 0,
        })
      }
    }
    load()
  }, [])

  async function handleNext() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await saveTesteFisico(user.id, values.pushups, values.pullups, values.squats)
      await saveCurrentStep(user.id, 'frequencia')
    }
    router.push('/onboarding/frequencia')
  }

  return (
    <div className="flex flex-col min-h-screen max-w-sm mx-auto w-full">
      <OnboardingHeader backHref="/onboarding/trava" />

      <div className="flex-1 flex flex-col px-5 py-4">
        <CoachBubble
          title="Teste físico rápido"
          subtitle="Sem julgamento. Esses números viram o ponto de partida das suas trilhas."
        />

        <div className="flex flex-col gap-4">
          {EXERCISES.map((ex) => (
            <div key={ex.key} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{ex.emoji}</span>
                  <div>
                    <p className="text-sm font-bold">{ex.label}</p>
                    <p className="text-xs text-muted-foreground">{ex.hint}</p>
                  </div>
                </div>
                <span className="text-3xl font-extrabold text-primary tabular-nums w-12 text-right">
                  {values[ex.key]}
                </span>
              </div>
              <Slider
                min={0}
                max={ex.max}
                step={1}
                value={[values[ex.key]]}
                onValueChange={([v]) => setValues(prev => ({ ...prev, [ex.key]: v }))}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0</span>
                <span>{ex.max}</span>
              </div>
            </div>
          ))}
        </div>

        <button className="mt-4 text-xs text-primary font-medium text-center">
          Não sei meus números, quero testar agora →
        </button>
      </div>

      <div className="px-5 pb-8 flex gap-3">
        <button
          onClick={() => router.push('/onboarding/trava')}
          className="h-14 px-5 rounded-full border border-border text-foreground font-medium hover:bg-muted transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={handleNext}
          disabled={saving}
          className="flex-1 h-14 bg-primary text-white font-bold text-base rounded-full hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Salvando...' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
