'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Protocol } from '@/types/database'

export default function TrocarProtocoloPage() {
  const router = useRouter()
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [currentProtocolId, setCurrentProtocolId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [protocolsRes, progressRes] = await Promise.all([
        supabase
          .from('protocols')
          .select('*')
          .eq('available', true)
          .order('order_index'),
        supabase
          .from('user_protocol_progress')
          .select('active_protocol_id')
          .eq('user_id', user.id)
          .single(),
      ])

      setProtocols(protocolsRes.data ?? [])
      setCurrentProtocolId(progressRes.data?.active_protocol_id ?? null)
      setSelected(progressRes.data?.active_protocol_id ?? null)
      setLoading(false)
    }
    load()
  }, [])

  async function handleConfirm() {
    if (!selected || selected === currentProtocolId) return
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('user_protocol_progress')
      .update({
        active_protocol_id: selected,
        current_phase_id: `${selected}-1`,
        current_day_number: 1,
      })
      .eq('user_id', user.id)

    if (error) {
      setError('Erro ao trocar treino. Tente novamente.')
      setSaving(false)
      return
    }

    router.push('/home')
    router.refresh()
  }

  const PROTOCOL_INFO: Record<string, { emoji: string; details: string[] }> = {
    iniciante: {
      emoji: '🌱',
      details: ['Variações acessíveis', 'Foco em padrão de movimento', 'Ideal para começar do zero'],
    },
    intermediario: {
      emoji: '⚡',
      details: ['Push-ups completos', 'Introdução a negativas', 'Pike e primeiras skills'],
    },
    avancado: {
      emoji: '🔥',
      details: ['Dips e pull-ups', 'Pistol squat', 'Muscle-up e handstand'],
    },
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    )
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
            <h1 className="text-xl font-semibold">Trocar treino</h1>
            <p className="text-sm text-muted-foreground">
              Seu histórico de treinos é preservado
            </p>
          </div>
        </div>

        {/* Lista de protocolos */}
        <div className="space-y-3">
          {protocols.map(protocol => {
            const info = PROTOCOL_INFO[protocol.id]
            const isCurrent = protocol.id === currentProtocolId
            const isSelected = protocol.id === selected

            return (
              <button
                key={protocol.id}
                onClick={() => setSelected(protocol.id)}
                className={cn(
                  'w-full border rounded-2xl p-5 text-left space-y-3 transition-all',
                  isSelected
                    ? 'border-foreground'
                    : 'border-border hover:border-foreground/40'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{info?.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{protocol.name}</h3>
                        {isCurrent && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                            atual
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {protocol.description}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  )}
                </div>

                {info?.details && (
                  <ul className="space-y-1 pl-1">
                    {info.details.map(d => (
                      <li key={d} className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-muted-foreground flex-shrink-0" />
                        {d}
                      </li>
                    ))}
                  </ul>
                )}
              </button>
            )
          })}
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Aviso antes de confirmar */}
        {selected !== currentProtocolId && !showConfirm && (
          <div className="bg-muted rounded-2xl p-4 space-y-3">
            <p className="text-sm font-medium">Antes de confirmar</p>
            <p className="text-sm text-muted-foreground">
              Você vai começar do Dia 1 da Fase 1 do protocolo{' '}
              <strong>{protocols.find(p => p.id === selected)?.name}</strong>.
              Seu histórico de treinos anteriores é mantido.
            </p>
            <Button
              className="w-full"
              onClick={() => setShowConfirm(true)}
            >
              Entendi, quero trocar
            </Button>
          </div>
        )}

        {showConfirm && selected !== currentProtocolId && (
          <Button
            className="w-full h-12"
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving ? 'Trocando...' : 'Confirmar troca de treino'}
          </Button>
        )}

        {selected === currentProtocolId && (
          <Button
            variant="outline"
            className="w-full h-12"
            disabled
          >
            Este é seu treino atual
          </Button>
        )}

      </div>
    </div>
  )
}