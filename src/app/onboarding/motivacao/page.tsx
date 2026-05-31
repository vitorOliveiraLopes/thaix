'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { saveMotivacao, saveCurrentStep } from '@/lib/onboarding-persist'
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader'
import { CoachBubble } from '@/components/onboarding/CoachBubble'

const OPTIONS = [
  { value: 'primeira-pullup',  label: 'Quero minha primeira pull-up strict', icon: '🏆' },
  { value: 'kipping',          label: 'Quero destravar kipping/butterfly',   icon: '🔄' },
  { value: 'muscle-up',        label: 'Quero meu primeiro muscle-up',        icon: '🔥' },
  { value: 'hspu',             label: 'Quero o HSPU (handstand push-up)',    icon: '🤸' },
  { value: 'gluteo',           label: 'Quero glúteo forte pra CrossFit',     icon: '💪' },
  { value: 'wods',             label: 'Quero render mais nos WODs',          icon: '⚡' },
  { value: 'explorando',       label: 'Tô só explorando',                    icon: '🧭' },
]

export default function OnboardingMotivacao() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleNext() {
    if (!selected) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await saveMotivacao(user.id, selected)
      await saveCurrentStep(user.id, 'como-conheceu') // próximo step
    }
    router.push('/onboarding/como-conheceu')
  }

  return (
    <div className="flex flex-col min-h-screen max-w-sm mx-auto w-full">
      <OnboardingHeader backHref="/onboarding/apresentacao" />
      <div className="flex-1 flex flex-col px-5 py-4">
        <CoachBubble title="O que te trouxe aqui?" subtitle="Pode escolher só uma. A gente ajusta o tom do app pra você." />
        <div className="flex flex-col gap-2">
          {OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setSelected(opt.value)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-sm font-medium text-left transition-all",
                selected === opt.value ? "border-primary bg-primary/10" : "border-border bg-white hover:border-primary/40"
              )}>
              <span className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
                style={{ background: selected === opt.value ? 'oklch(0.63 0.28 336)' : 'oklch(0.91 0.012 80)' }}>
                {opt.icon}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-5 pb-8">
        <button onClick={handleNext} disabled={!selected || saving}
          className="w-full h-14 bg-primary text-white font-bold text-base rounded-full hover:bg-primary/90 transition-colors disabled:opacity-40">
          {saving ? 'Salvando...' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
