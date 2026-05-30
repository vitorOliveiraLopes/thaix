'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PROTOCOL_LABELS } from '@/lib/onboarding'
import { getRecommendedProtocol, markOnboardingComplete } from '@/lib/onboarding-persist'

export default function OnboardingProtocolo() {
  const router = useRouter()
  const [protocol, setProtocol] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Busca protocolo salvo no banco (não sessionStorage)
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const p = await getRecommendedProtocol(user.id)
      setProtocol(p)
    }
    load()
  }, [router])

  async function handleConfirm() {
    if (!protocol) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Marca onboarding completo
    await markOnboardingComplete(user.id)

    router.push('/paywall')
  }

  const info = protocol ? PROTOCOL_LABELS[protocol] : null
  const PHASE_LABELS = ['Fundação', 'Estrutura', 'Potência', 'Maestria']

  if (!protocol) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-sm mx-auto w-full px-5">
      <div className="flex-1 flex flex-col justify-center py-10">
        <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase mb-2">SUA TRILHA DE SKILL</p>
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">Sua trilha inicial</h1>
        <p className="text-muted-foreground text-sm mb-6">Recomendada com base no seu teste. Você pode trocar a qualquer momento.</p>

        <div className="bg-white border-2 border-primary rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-extrabold">{info?.name}</h2>
            <span className="text-xs font-bold bg-primary text-white px-3 py-1 rounded-full">RECOMENDADO</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{info?.description}</p>
          <div className="grid grid-cols-3 gap-2">
            {[{ label: '28 dias', sublabel: 'duração' }, { label: '4 dias/sem', sublabel: 'frequência' }, { label: '28 sessões', sublabel: 'total' }].map(s => (
              <div key={s.label} className="bg-muted rounded-xl p-2 text-center">
                <p className="text-xs font-bold">{s.label}</p>
                <p className="text-[10px] text-muted-foreground">{s.sublabel}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-3">4 BLOCOS DE PROGRESSÃO</p>
          <div className="flex gap-1">
            {PHASE_LABELS.map((phase, i) => (
              <div key={i} className="flex-1 text-center">
                <div className={`h-2 rounded-full mb-1 ${i === 0 ? 'bg-primary' : 'bg-border'}`} />
                <span className="text-[10px] text-muted-foreground">{phase}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleConfirm} disabled={saving}
          className="w-full h-14 bg-primary text-white font-bold text-base rounded-full hover:bg-primary/90 transition-colors disabled:opacity-40">
          {saving ? 'Salvando...' : 'Continuar'}
        </button>
        <button className="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
          onClick={() => router.push('/onboarding/teste-fisico')}>
          Refazer o teste
        </button>
      </div>
    </div>
  )
}
