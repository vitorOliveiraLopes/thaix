'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { savePesoAltura, saveCurrentStep, getProfilePesoAltura } from '@/lib/onboarding-persist'
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader'
import { CoachBubble } from '@/components/onboarding/CoachBubble'

function NumberInput({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  unit: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  function clamp(v: number) {
    return Math.min(max, Math.max(min, v))
  }

  return (
    <div className="flex-1 flex flex-col items-center gap-3 bg-white rounded-2xl p-5 shadow-sm">
      <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
        {label}
      </p>

      {/* Botão + */}
      <button
        onClick={() => onChange(clamp(value + 1))}
        className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl font-bold hover:bg-primary/10 active:bg-primary/20 transition-colors"
      >
        +
      </button>

      {/* Valor atual editável */}
      <div className="flex items-baseline gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const v = parseInt(e.target.value)
            if (!isNaN(v)) onChange(clamp(v))
          }}
          className="text-4xl font-extrabold text-foreground w-20 text-center bg-transparent border-none outline-none tabular-nums"
        />
        <span className="text-base font-medium text-muted-foreground">{unit}</span>
      </div>

      {/* Botão - */}
      <button
        onClick={() => onChange(clamp(value - 1))}
        className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl font-bold hover:bg-primary/10 active:bg-primary/20 transition-colors"
      >
        −
      </button>
    </div>
  )
}

export default function OnboardingPeso() {
  const router = useRouter()
  const [peso, setPeso] = useState(65)
  const [altura, setAltura] = useState(165)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const data = await getProfilePesoAltura(user.id)
      if (data?.weight_kg) setPeso(data.weight_kg)
      if (data?.height_cm) setAltura(data.height_cm)
    }
    load()
  }, [])

  async function handleNext() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await savePesoAltura(user.id, peso, altura)
      await saveCurrentStep(user.id, 'protocolo')
    }
    router.push('/onboarding/protocolo')
  }

  return (
    <div className="flex flex-col min-h-screen max-w-sm mx-auto w-full">
      <OnboardingHeader backHref="/onboarding/frequencia" />

      <div className="flex-1 flex flex-col px-5 py-4">
        <CoachBubble
          title="Peso & Altura"
          subtitle="Pra calibrar a carga das sessões no seu nível."
        />

        <div className="flex gap-4">
          <NumberInput
            label="Peso"
            unit="kg"
            value={peso}
            min={30}
            max={200}
            onChange={setPeso}
          />
          <NumberInput
            label="Altura"
            unit="cm"
            value={altura}
            min={140}
            max={220}
            onChange={setAltura}
          />
        </div>
      </div>

      <div className="px-5 pb-8">
        <button
          onClick={handleNext}
          disabled={saving}
          className="w-full h-14 bg-primary text-white font-bold text-base rounded-full hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Salvando...' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
