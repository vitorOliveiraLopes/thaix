'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, ArrowLeft } from 'lucide-react'

const PLANS = [
  {
    id: 'mensal',
    name: 'Mensal',
    price: 'R$ 59,90',
    period: '/mês',
    description: 'Flexibilidade total',
    highlight: false,
    features: ['Acesso completo', 'Todos os protocolos', 'Cursos incluídos'],
  },
  {
    id: 'trimestral',
    name: 'Trimestral',
    price: 'R$ 39,90',
    period: '/mês',
    description: 'Cobrado R$ 119,70 a cada 3 meses',
    highlight: false,
    features: ['Acesso completo', 'Todos os protocolos', 'Cursos incluídos'],
  },
  {
    id: 'anual',
    name: 'Anual',
    price: 'R$ 16,40',
    period: '/mês',
    description: 'Cobrado R$ 197,00 por ano · Economia de 72%',
    highlight: true,
    badge: 'Escolha de 87% dos alunos',
    features: ['Acesso completo', 'Todos os protocolos', 'Cursos incluídos'],
  },
]

export default function AssinaturaPage() {
  const router = useRouter()

  function handleSelectPlan(planId: string) {
    // Por enquanto abre WhatsApp — substituir pelo gateway quando integrado
    const message = encodeURIComponent(`Olá! Quero assinar o plano ${planId} do ThaixSkill.`)
    window.open(`https://wa.me/5524998315673?text=${message}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto px-4 pt-10 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-muted rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold">Planos</h1>
            <p className="text-sm text-muted-foreground">
              Escolha o melhor para você
            </p>
          </div>
        </div>

        {/* Planos */}
        <div className="space-y-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'border rounded-2xl p-5 space-y-4',
                plan.highlight && 'border-foreground'
              )}
            >
              {plan.highlight && plan.badge && (
                <span className="text-xs font-medium bg-foreground text-background px-2 py-1 rounded-full">
                  {plan.badge}
                </span>
              )}

              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {plan.description}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.highlight ? 'default' : 'outline'}
                onClick={() => handleSelectPlan(plan.id)}
              >
                Assinar plano {plan.name.toLowerCase()}
              </Button>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Cancele quando quiser · Sem taxas ocultas
        </p>

      </div>
    </div>
  )
}