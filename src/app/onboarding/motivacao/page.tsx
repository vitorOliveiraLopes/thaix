'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'primeira-pullup', label: 'Minha primeira pull-up' },
  { value: 'muscle-up', label: 'Chegar no muscle-up' },
  { value: 'hspu', label: 'Handstand push-up' },
  { value: 'wods', label: 'Render mais nos WODs' },
  { value: 'base', label: 'Construir uma base sólida' },
  { value: 'explorando', label: 'Só explorando por enquanto' },
]

export default function OnboardingMotivacao() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)

  function handleNext() {
    if (!selected) return
    sessionStorage.setItem('onboarding_motivacao', selected)
    router.push('/onboarding/objetivo')
  }

  return (
    <div className="flex-1 flex flex-col px-6 py-10 max-w-sm mx-auto w-full">

      <div className="mb-2">
        <div className="flex gap-1 mb-6">
          <div className="h-1 flex-1 rounded-full bg-foreground" />
          <div className="h-1 flex-1 rounded-full bg-muted" />
          <div className="h-1 flex-1 rounded-full bg-muted" />
        </div>
        <p className="text-xs text-muted-foreground mb-1">Pergunta 1 de 3</p>
        <h2 className="text-2xl font-semibold tracking-tight">
          O que te trouxe aqui?
        </h2>
      </div>

      <div className="flex-1 flex flex-col gap-2 mt-6">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelected(opt.value)}
            className={cn(
              "w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all",
              selected === opt.value
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background hover:border-foreground/40"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Button
        className="w-full h-12 mt-6"
        disabled={!selected}
        onClick={handleNext}
      >
        Continuar
      </Button>

    </div>
  )
}