'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { saveSkills, saveCurrentStep, getOnboardingResponses } from '@/lib/onboarding-persist'
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader'
import { CoachBubble } from '@/components/onboarding/CoachBubble'

// ─── Skills disponíveis ───────────────────────────────────────────────────────
//
// Os valores (value) DEVEM corresponder exatamente aos IDs da tabela `skills`
// no banco. Eles são usados como FK em user_skill_progress e como chave
// em todo o sistema de geração de treinos.
//
// IDs válidos: 'pull-up' | 'c2b' | 'bmu' | 't2b' | 'hspu'

const SKILL_OPTIONS = [
  {
    value:    'pull-up',
    label:    'Pull-up',
    sublabel: 'Strict, kipping ou butterfly',
    icon:     '🏋️',
  },
  {
    value:    'c2b',
    label:    'Chest to Bar (C2B)',
    sublabel: 'Puxada com peito na barra',
    icon:     '💥',
  },
  {
    value:    'bmu',
    label:    'Bar Muscle-up (BMU)',
    sublabel: 'Transição acima da barra',
    icon:     '🥇',
  },
  {
    value:    't2b',
    label:    'Toes-to-Bar (T2B)',
    sublabel: 'Pés na barra, core e quadril',
    icon:     '✨',
  },
  {
    value:    'hspu',
    label:    'HSPU',
    sublabel: 'Handstand push-up, força invertida',
    icon:     '🤸',
  },
] as const

type SkillId = typeof SKILL_OPTIONS[number]['value']

// ─── Component ───────────────────────────────────────────────────────────────

export default function OnboardingSkills() {
  const router = useRouter()
  const [selected, setSelected] = useState<SkillId[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const data = await getOnboardingResponses(user.id)
      if (Array.isArray(data?.skills)) {
        setSelected(data.skills.filter((s: string): s is SkillId =>
          SKILL_OPTIONS.some(opt => opt.value === s)
        ))
      }
    }
    load()
  }, [])

  function toggle(value: SkillId) {
    setSelected(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
  }

  async function handleNext() {
    if (selected.length === 0) return
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await saveSkills(user.id, selected)
      await saveCurrentStep(user.id, 'trava')
    }

    router.push('/onboarding/trava')
  }

  return (
    <div className="flex flex-col min-h-screen max-w-sm mx-auto w-full">
      <OnboardingHeader backHref="/onboarding/como-conheceu" />

      <div className="flex-1 flex flex-col px-5 py-4 gap-4">
        <CoachBubble
          title="Quais skills você quer destravar?"
          subtitle="Escolha uma ou mais. Vamos montar uma trilha personalizada para cada uma."
        />

        <div className="flex flex-col gap-2">
          {SKILL_OPTIONS.map(opt => {
            const isSelected = selected.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all',
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-white hover:border-primary/40'
                )}
              >
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                  style={{
                    background: isSelected
                      ? 'oklch(0.63 0.28 336)'
                      : 'oklch(0.91 0.012 80)',
                  }}
                >
                  {opt.icon}
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {opt.sublabel}
                  </span>
                </span>

                <span
                  className={cn(
                    'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all',
                    isSelected ? 'bg-primary border-primary' : 'border-border'
                  )}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </span>
              </button>
            )
          })}
        </div>

        {selected.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Selecione ao menos uma skill para continuar
          </p>
        )}
      </div>

      <div className="px-5 pb-8">
        <button
          onClick={handleNext}
          disabled={saving || selected.length === 0}
          className="w-full h-14 bg-primary text-white font-bold text-base rounded-full hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Salvando...' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
