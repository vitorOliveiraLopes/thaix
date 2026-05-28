'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { recommendProtocol } from '@/lib/onboarding'

export default function OnboardingTesteFisico() {
  const router = useRouter()
  const [pushups, setPushups] = useState(0)
  const [pullups, setPullups] = useState(0)
  const [squats, setSquats] = useState(0)
  const [saving, setSaving] = useState(false)

  async function handleNext() {
    setSaving(true)
    const protocol = recommendProtocol({ pushups, pullups, squats })
    sessionStorage.setItem('onboarding_pushups', String(pushups))
    sessionStorage.setItem('onboarding_pullups', String(pullups))
    sessionStorage.setItem('onboarding_squats', String(squats))
    sessionStorage.setItem('onboarding_protocol', protocol)
    router.push('/onboarding/protocolo')
  }

  return (
    <div className="flex-1 flex flex-col px-6 py-10 max-w-sm mx-auto w-full">

      <div className="mb-2">
        <div className="flex gap-1 mb-6">
          <div className="h-1 flex-1 rounded-full bg-foreground" />
          <div className="h-1 flex-1 rounded-full bg-foreground" />
          <div className="h-1 flex-1 rounded-full bg-foreground" />
        </div>
        <p className="text-xs text-muted-foreground mb-1">Pergunta 3 de 3</p>
        <h2 className="text-2xl font-semibold tracking-tight">
          Teste físico rápido
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Quantas você consegue fazer sem parar?
        </p>
      </div>

      <div className="flex-1 flex flex-col gap-8 mt-8">

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Push-ups strict</span>
            <span className="text-2xl font-semibold tabular-nums w-12 text-right">
              {pushups}
            </span>
          </div>
          <Slider
            min={0} max={50} step={1}
            value={[pushups]}
            onValueChange={([v]) => setPushups(v)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span><span>50+</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Pull-ups strict</span>
            <span className="text-2xl font-semibold tabular-nums w-12 text-right">
              {pullups}
            </span>
          </div>
          <Slider
            min={0} max={20} step={1}
            value={[pullups]}
            onValueChange={([v]) => setPullups(v)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span><span>20+</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Air squats sem parar</span>
            <span className="text-2xl font-semibold tabular-nums w-12 text-right">
              {squats}
            </span>
          </div>
          <Slider
            min={0} max={100} step={1}
            value={[squats]}
            onValueChange={([v]) => setSquats(v)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span><span>100+</span>
          </div>
        </div>

      </div>

      <Button
        className="w-full h-12 mt-8"
        onClick={handleNext}
        disabled={saving}
      >
        Ver meu protocolo
      </Button>

    </div>
  )
}