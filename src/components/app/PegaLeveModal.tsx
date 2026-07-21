'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  onClose: () => void
  onSaved: (score: number) => void
}

const EFFORT_LABELS: Record<number, { label: string; emoji: string; color: string }> = {
  0:  { label: 'Sem esforço',     emoji: '😄', color: 'text-green-500' },
  1:  { label: 'Quase nada',      emoji: '🙂', color: 'text-green-400' },
  2:  { label: 'Muito leve',      emoji: '😊', color: 'text-lime-500' },
  3:  { label: 'Leve',            emoji: '😐', color: 'text-yellow-400' },
  4:  { label: 'Moderado',        emoji: '😕', color: 'text-yellow-500' },
  5:  { label: 'Médio',           emoji: '😣', color: 'text-orange-400' },
  6:  { label: 'Intenso',         emoji: '😖', color: 'text-orange-500' },
  7:  { label: 'Forte',           emoji: '😫', color: 'text-red-400' },
  8:  { label: 'Muito forte',     emoji: '😤', color: 'text-red-500' },
  9:  { label: 'Severo',          emoji: '🤯', color: 'text-red-600' },
  10: { label: 'Máximo esforço',  emoji: '💀', color: 'text-red-700' },
}

export function PegaLeveModal({ onClose, onSaved }: Props) {
  const [score, setScore] = useState(0)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase
      .from('daily_pain_logs')
      .upsert(
        { user_id: user.id, date: today, pain_score: score },
        { onConflict: 'user_id,date' }
      )

    if (!error) {
      onSaved(score)
    }
    setSaving(false)
  }

  const info = EFFORT_LABELS[score]

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-end">
      <div className="w-full max-w-md mx-auto bg-background border border-border rounded-t-2xl p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">PegaLeve 💪</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Como foi seu esforço hoje?
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Score display */}
        <div className="text-center space-y-1">
          <span className="text-5xl">{info.emoji}</span>
          <p className={cn('text-lg font-semibold', info.color)}>
            {score} — {info.label}
          </p>
        </div>

        {/* Slider */}
        <div className="space-y-3">
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={score}
            onChange={e => setScore(Number(e.target.value))}
            className="w-full accent-foreground"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 — Sem esforço</span>
            <span>10 — Máximo</span>
          </div>
        </div>

        {/* Números clicáveis */}
        <div className="grid grid-cols-11 gap-1">
          {Array.from({ length: 11 }, (_, i) => (
            <button
              key={i}
              onClick={() => setScore(i)}
              className={cn(
                'h-8 rounded-lg text-xs font-medium transition-all',
                score === i
                  ? 'bg-foreground text-background'
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              {i}
            </button>
          ))}
        </div>

        <Button
          className="w-full h-11"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Salvando...' : 'Registrar esforço do dia'}
        </Button>

      </div>
    </div>
  )
}