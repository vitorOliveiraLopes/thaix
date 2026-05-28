'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PROTOCOL_LABELS } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'

export default function OnboardingProtocolo() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [protocol] = useState<string>(() => {
    if (typeof window === 'undefined') return 'iniciante'
    return sessionStorage.getItem('onboarding_protocol') ?? 'iniciante'
    })


  async function handleConfirm() {
    if (!protocol) return
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const firstPhaseId = `${protocol}-1`

    const { error: onboardingError } = await supabase
	.from('onboarding_responses')
	.upsert({
		user_id: user.id,
		motivacao: sessionStorage.getItem('onboarding_motivacao'),
		objetivo: sessionStorage.getItem('onboarding_objetivo'),
		pushups: Number(sessionStorage.getItem('onboarding_pushups') ?? 0),
		pullups: Number(sessionStorage.getItem('onboarding_pullups') ?? 0),
		squats: Number(sessionStorage.getItem('onboarding_squats') ?? 0),
		protocol_recommended: protocol,
		completed_at: new Date().toISOString(),
	}, { onConflict: 'user_id' })

	if (onboardingError) {
	console.error('Erro ao salvar onboarding:', onboardingError)
	}

    // Salva dados do onboarding no perfil
    const motivacao = sessionStorage.getItem('onboarding_motivacao')
    const objetivo = sessionStorage.getItem('onboarding_objetivo')

    if (motivacao || objetivo) {
      await supabase
        .from('profiles')
        .update({ name: user.user_metadata?.full_name ?? null })
        .eq('user_id', user.id)
    }

    // Limpa sessionStorage
    ;['onboarding_motivacao','onboarding_objetivo','onboarding_pushups',
      'onboarding_pullups','onboarding_squats','onboarding_protocol']
      .forEach(k => sessionStorage.removeItem(k))

    router.push('/home')
  }

  const info = protocol ? PROTOCOL_LABELS[protocol] : null

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-sm mx-auto w-full text-center">

      <div className="mb-10 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          Seu protocolo
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {info?.name ?? '...'}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {info?.description}
        </p>
      </div>

      <div className="w-full bg-muted rounded-2xl p-6 mb-8 text-left space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Duração</span>
          <span className="font-medium">28 dias</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Fases</span>
          <span className="font-medium">4 semanas</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Sessões</span>
          <span className="font-medium">7 por semana</span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive mb-4">{error}</p>
      )}

      <div className="w-full space-y-3">
        <Button
          className="w-full h-12 text-base"
          onClick={handleConfirm}
          disabled={saving || !protocol}
        >
          {saving ? 'Salvando...' : 'Começar agora'}
        </Button>

        <button
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => router.push('/onboarding/teste-fisico')}
        >
          Refazer o teste
        </button>
      </div>

    </div>
  )
}