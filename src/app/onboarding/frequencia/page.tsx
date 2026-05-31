'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { saveFrequencia, saveCurrentStep, saveHorarios } from '@/lib/onboarding-persist'
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader'
import { CoachBubble } from '@/components/onboarding/CoachBubble'

const DAYS_OPTIONS = [3, 4, 5]
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DEFAULT_DAYS: Record<number, number[]> = {
  3: [1, 3, 5],
  4: [1, 2, 4, 6],
  5: [1, 2, 3, 4, 6],
}

export default function OnboardingFrequencia() {
  const router = useRouter()
  const [freq, setFreq] = useState(4)
  const [activeDays, setActiveDays] = useState<number[]>(DEFAULT_DAYS[4])
  const [horarioTreino, setHorarioTreino] = useState('07:30')
  const [horarioHidratacao, setHorarioHidratacao] = useState('14:00')
  const [saving, setSaving] = useState(false)

  function handleFreqChange(n: number) {
    setFreq(n)
    setActiveDays(DEFAULT_DAYS[n])
  }

  function toggleDay(i: number) {
    setActiveDays(prev =>
      prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
    )
  }

  async function handleNext() {
    setSaving(true)

    // Pede permissão de notificação nativamente (browser/PWA)
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await Promise.all([
        saveFrequencia(user.id, freq, activeDays),
        saveHorarios(user.id, horarioTreino, horarioHidratacao),
        saveCurrentStep(user.id, 'peso'),
      ])
    }

    router.push('/onboarding/peso')
  }

  return (
    <div className="flex flex-col min-h-screen max-w-sm mx-auto w-full">
      <OnboardingHeader backHref="/onboarding/teste-fisico" />

      <div className="flex-1 flex flex-col px-5 py-4 gap-4">
        <CoachBubble
          title="Quando e quantas vezes você treina?"
          subtitle="Vamos montar sua agenda de skills e te lembrar nos horários certos."
        />

        {/* Frequência */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-3">
            SESSÕES POR SEMANA
          </p>
          <div className="flex gap-3 mb-4">
            {DAYS_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => handleFreqChange(n)}
                className={cn(
                  "flex-1 py-4 rounded-2xl border text-center transition-all",
                  freq === n
                    ? "bg-primary border-primary text-white"
                    : "bg-background border-border hover:border-primary/40"
                )}
              >
                <span className="block text-2xl font-extrabold">{n}</span>
                <span className="text-xs font-medium opacity-80">dias</span>
              </button>
            ))}
          </div>

          {/* Dias da semana */}
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-2">
            SEUS DIAS DE SKILL
          </p>
          <div className="flex gap-1.5 justify-between">
            {WEEKDAYS.map((day, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                  activeDays.includes(i)
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {day}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Toque para ajustar.
          </p>
        </div>

        {/* Horários */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase px-4 pt-4 pb-2">
            LEMBRETES DIÁRIOS
          </p>

          {/* Treino */}
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
              onChange={(e) => setHorarioTreino(e.target.value)}
              className="text-xl font-extrabold text-primary bg-transparent border-none outline-none cursor-pointer text-right"
            />
          </label>

          {/* Hidratação */}
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
              onChange={(e) => setHorarioHidratacao(e.target.value)}
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
          disabled={saving}
          className="w-full h-14 bg-primary text-white font-bold text-base rounded-full hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Salvando...' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
