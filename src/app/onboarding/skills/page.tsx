'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { saveSkills, saveCurrentStep } from '@/lib/onboarding-persist'
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader'
import { CoachBubble } from '@/components/onboarding/CoachBubble'

const OPTIONS = [
  { value: 'pullup-strict',  label: 'Pull-up strict',            icon: '🏋️' },
  { value: 'kipping',        label: 'Kipping / butterfly',       icon: '🔄' },
  { value: 't2b',            label: 'Toes-to-bar (T2B)',         icon: '✨' },
  { value: 'muscle-up',      label: 'Muscle-up (bar ou ring)',   icon: '🥇' },
  { value: 'hspu',           label: 'HSPU (handstand push-up)',  icon: '📈' },
  { value: 'double-under',   label: 'Double-under fluido',       icon: '⚡' },
  { value: 'pistol',         label: 'Pistol squat',              icon: '⚖️' },
  { value: 'gluteo',         label: 'Glúteo forte (escasso no box)', icon: '🎯' },
]

export default function OnboardingSkills() {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function toggle(value: string) {
    setSelected(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
  }

  async function handleNext() {
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
      <div className="flex-1 flex flex-col px-5 py-4">
        <CoachBubble title="Quais skills você quer destravar?" subtitle="Marca quantos quiser. Vamos te dar uma trilha pra cada." />
        <div className="flex flex-col gap-2">
          {OPTIONS.map((opt) => {
            const isSelected = selected.includes(opt.value)
            return (
              <button key={opt.value} onClick={() => toggle(opt.value)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-sm font-medium text-left transition-all",
                  isSelected ? "border-primary bg-primary/10" : "border-border bg-white hover:border-primary/40"
                )}>
                <span className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
                  style={{ background: isSelected ? 'oklch(0.63 0.28 336)' : 'oklch(0.91 0.012 80)' }}>
                  {opt.icon}
                </span>
                <span className="flex-1">{opt.label}</span>
                <span className={cn("w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all",
                  isSelected ? "bg-primary border-primary" : "border-border")}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="px-5 pb-8">
        <button onClick={handleNext} disabled={saving}
          className="w-full h-14 bg-primary text-white font-bold text-base rounded-full hover:bg-primary/90 transition-colors disabled:opacity-40">
          {saving ? 'Salvando...' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
