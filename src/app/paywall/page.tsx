'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function PaywallPage() {
  const router = useRouter()
  const [plan, setPlan] = useState<'anual' | 'mensal'>('anual')

  function handleContinue() {
    // TODO: integrar gateway de pagamento
    router.push('/home')
  }

  const FEATURES_ANUAL = [
    'Acesso completo a todos os treinos',
    'Reavaliações ilimitadas',
    'Cancele quando quiser',
  ]
  const FEATURES_MENSAL = [
    'Todos os treinos do Thaix',
    'Vídeos guiados em HD',
    'Reavaliações periódicas',
    'Suporte da equipe',
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-sm mx-auto w-full px-5">
      <div className="flex-1 flex flex-col justify-center py-10">

        <h1 className="text-3xl font-extrabold tracking-tight mb-1">
          Oferta especial.
        </h1>
        <p className="text-muted-foreground text-sm mb-6">Cancele quando quiser.</p>

        {/* Toggle anual / mensal */}
        <div className="flex bg-muted rounded-2xl p-1 mb-5">
          {(['anual', 'mensal'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPlan(p)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all",
                plan === p ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              {p === 'anual' ? 'Anual' : 'Mensal'}
            </button>
          ))}
        </div>

        {/* Card do plano anual */}
        <div className={cn(
          "rounded-2xl border-2 p-5 mb-4 bg-white relative transition-all",
          plan === 'anual' ? "border-primary" : "border-border opacity-60"
        )}>
          {plan === 'anual' && (
            <span className="absolute -top-3 left-4 text-xs font-bold bg-primary text-white px-3 py-1 rounded-full">
              ESCOLHA DE 87% DOS ALUNOS
            </span>
          )}

          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-2">
            {plan === 'anual' ? 'PLANO ANUAL' : 'PLANO MENSAL'}
          </p>

          {plan === 'anual' ? (
            <>
              <p className="text-sm text-muted-foreground line-through">R$ 59,90/mês</p>
              <p className="text-4xl font-extrabold text-primary">
                R$ 16,40 <span className="text-base font-semibold text-foreground">/ mês</span>
              </p>
              <p className="text-sm text-muted-foreground mb-3">Ou apenas R$ 0,54 por dia</p>
              <div className="flex gap-2 mb-4">
                <span className="text-xs font-bold bg-accent text-foreground px-2 py-1 rounded-full">
                  Economize 72%
                </span>
                <span className="text-xs font-bold bg-muted text-foreground px-2 py-1 rounded-full">
                  🎁 7 dias grátis
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="text-4xl font-extrabold">
                R$ 59,90 <span className="text-base font-semibold text-muted-foreground">/ mês</span>
              </p>
              <p className="text-sm text-muted-foreground mb-4">Renova automaticamente</p>
            </>
          )}

          <div className="space-y-2">
            {(plan === 'anual' ? FEATURES_ANUAL : FEATURES_MENSAL).map(f => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleContinue}
          className="w-full h-14 bg-primary text-white font-bold text-base rounded-full hover:bg-primary/90 transition-colors"
        >
          {plan === 'anual' ? 'Experimente por R$ 0,00' : 'Assinar plano mensal'}
        </button>

        {plan === 'anual' && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            7 dias grátis, cancele quando quiser
          </p>
        )}

        <button
          onClick={() => router.push('/home')}
          className="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors text-center w-full"
        >
          Continuar sem assinar
        </button>

        <div className="flex justify-between mt-8">
          <button className="text-xs text-muted-foreground hover:text-foreground">Privacidade</button>
          <button className="text-xs text-muted-foreground hover:text-foreground">Termos</button>
        </div>
      </div>
    </div>
  )
}
