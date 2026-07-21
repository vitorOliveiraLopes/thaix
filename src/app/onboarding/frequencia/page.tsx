'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { saveFrequencia, saveCurrentStep, saveHorarios } from '@/lib/onboarding-persist'
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader'
import { CoachBubble } from '@/components/onboarding/CoachBubble'

// ─── Constants ───────────────────────────────────────────────────────────────

const WEEKDAYS = [
  { label: 'Dom', index: 0 },
  { label: 'Seg', index: 1 },
  { label: 'Ter', index: 2 },
  { label: 'Qua', index: 3 },
  { label: 'Qui', index: 4 },
  { label: 'Sex', index: 5 },
  { label: 'Sáb', index: 6 },
]

// Sugestões de preset para facilitar a seleção inicial
const PRESETS = [
  { label: '3×/semana',  days: [1, 3, 5] },
  { label: '4×/semana',  days: [1, 2, 4, 6] },
  { label: '5×/semana',  days: [1, 2, 3, 4, 6] },
]

const MIN_DAYS = 2
const MAX_DAYS = 6

// ─── Component ───────────────────────────────────────────────────────────────

export default function OnboardingFrequencia() {
  const router = useRouter()
  const [activeDays, setActiveDays] = useState<number[]>(PRESETS[1].days) // 4×/semana default
  const [horarioTreino, setHorarioTreino] = useState('07:30')
  const [horarioHidratacao, setHorarioHidratacao] = useState('14:00')
  const [saving, setSaving] = useState(false)

  function toggleDay(index: number) {
    setActiveDays(prev => {
      const isActive = prev.includes(index)
      // Não deixa remover se já está no mínimo
      if (isActive && prev.length <= MIN_DAYS) return prev
      return isActive ? prev.filter(d => d !== index) : [...prev, index]
    })
  }

  function applyPreset(days: number[]) {
    setActiveDays(days)
  }

  async function handleNext() {
    setSaving(true)

    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await Promise.all([
        saveFrequencia(user.id, activeDays.length, activeDays),
        saveHorarios(user.id, horarioTreino, horarioHidratacao),
        saveCurrentStep(user.id, 'protocolo'),
      ])
    }

    router.push('/onboarding/protocolo')
  }

  const sortedDays = [...activeDays].sort((a, b) => a - b)
  const daysLabel = sortedDays.map(d => WEEKDAYS[d].label).join(', ')
  const canContinue = activeDays.length >= MIN_DAYS && !saving

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen max-w-sm mx-auto w-full">
      <OnboardingHeader backHref="/onboarding/teste-fisico" />

      <div className="flex-1 flex flex-col px-5 py-4 gap-4">
        <CoachBubble
          title="Quais dias você quer treinar?"
          subtitle="Escolha seus dias de skill. Você pode ajustar depois a qualquer momento."
        />

        {/* Seletor de dias */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">

          {/* Grade de dias */}
          <div>
            <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-3">
              SEUS DIAS DE SKILL
            </p>
            <div className="flex gap-1.5 justify-between">
              {WEEKDAYS.map(({ label, index }) => {
                const isActive = activeDays.includes(index)
                return (
                  <button
                    key={index}
                    onClick={() => toggleDay(index)}
                    className={cn(
                      'flex-1 py-3 rounded-xl text-xs font-bold transition-all',
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Presets */}
          <div>
            <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-2">
              SUGESTÕES RÁPIDAS
            </p>
            <div className="flex gap-2">
              {PRESETS.map(preset => {
                const isSelected =
                  preset.days.length === activeDays.length &&
                  preset.days.every(d => activeDays.includes(d))
                return (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(preset.days)}
                    className={cn(
                      'flex-1 py-2 rounded-xl border text-xs font-bold transition-all',
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Resumo */}
          <div className="bg-muted rounded-xl px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground">{activeDays.length}×/semana:</span>{' '}
              {daysLabel}
            </p>
            {activeDays.length < MIN_DAYS && (
              <p className="text-xs text-destructive mt-1">
                Selecione ao menos {MIN_DAYS} dias
              </p>
            )}
          </div>
        </div>

        {/* Horários */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase px-4 pt-4 pb-2">
            LEMBRETES DIÁRIOS
          </p>

          <label className="flex items-center justify-between px-4 py-3 border-b border-border cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Treino</p>
                <p className="text-xs text-muted-foreground">Nos seus dias de skill</p>
              </div>
            </div>
            <input
              type="time"
              value={horarioTreino}
              onChange={e => setHorarioTreino(e.target.value)}
              className="text-xl font-extrabold text-primary bg-transparent border-none outline-none cursor-pointer text-right"
            />
          </label>

          <label className="flex items-center justify-between px-4 py-3 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <span className="text-base">💧</span>
              </div>
              <div>
                <p className="font-semibold text-sm">Hidratação</p>
                <p className="text-xs text-muted-foreground">Lembrete diário de água</p>
              </div>
            </div>
            <input
              type="time"
              value={horarioHidratacao}
              onChange={e => setHorarioHidratacao(e.target.value)}
              className="text-xl font-extrabold text-primary bg-transparent border-none outline-none cursor-pointer text-right"
            />
          </label>
        </div>

        {/* Aviso de notificação */}
        <div className="bg-primary/10 rounded-2xl px-4 py-3">
          <p className="text-xs text-foreground leading-snug">
            <span className="text-primary font-bold">Atletas com notificação ativa</span>{' '}
            têm <strong>3x mais chance</strong> de manter o ritmo.
            Vamos pedir permissão ao continuar.
          </p>
        </div>
      </div>

      <div className="px-5 pb-8">
        <button
          onClick={handleNext}
          disabled={!canContinue}
          className="w-full h-14 bg-primary text-white font-bold text-base rounded-full hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Salvando...' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
