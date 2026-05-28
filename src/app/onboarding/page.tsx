'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function OnboardingWelcome() {
  const router = useRouter()

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center max-w-sm mx-auto">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
          ThaixSkill
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Vamos montar seu plano
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Responde 3 perguntas rápidas e a gente recomenda o protocolo certo pra você.
        </p>
      </div>

      <div className="w-full space-y-3">
        <Button
          className="w-full h-12 text-base"
          onClick={() => router.push('/onboarding/motivacao')}
        >
          Começar
        </Button>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Leva menos de 2 minutos
      </p>
    </div>
  )
}