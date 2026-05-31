'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, X, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

type PR = {
  id: string
  exercise_id: string
  value: number
  unit: string
  date: string
  notes: string | null
}

const COMMON_EXERCISES = [
  { id: 'pullup', name: 'Pull-up' },
  { id: 'pushup', name: 'Push-up' },
  { id: 'dip', name: 'Ring Dip' },
  { id: 'muscle-up-argola', name: 'Ring Muscle-up' },
  { id: 'handstand-hold', name: 'Handstand Hold' },
  { id: 'pistol-progression', name: 'Pistol Squat' },
  { id: 'squat', name: 'Overhead Squat' },
  { id: 'leg-raise', name: 'Toes-to-Bar' },
]

const UNITS = [
  { value: 'reps', label: 'Repetições' },
  { value: 'kg', label: 'Quilogramas (kg)' },
  { value: 'seconds', label: 'Segundos' },
]

export default function PRsPage() {
  const router = useRouter()
  const [prs, setPrs] = useState<PR[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [selectedExercise, setSelectedExercise] = useState(COMMON_EXERCISES[0].id)
  const [customExercise, setCustomExercise] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('reps')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('pr_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    setPrs(data ?? [])
    setLoading(false)
  }

  async function handleSave() {
    const numValue = parseFloat(value.replace(',', '.'))
    if (isNaN(numValue) || numValue <= 0) return

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const exerciseId = customExercise.trim() || selectedExercise

    const { error } = await supabase
      .from('pr_entries')
      .insert({
        user_id: user.id,
        exercise_id: exerciseId,
        value: numValue,
        unit,
        date: new Date().toISOString().split('T')[0],
        notes: notes.trim() || null,
      })

    if (!error) {
      setShowModal(false)
      setValue('')
      setNotes('')
      setCustomExercise('')
      setUnit('reps')
      await load()
    }

    setSaving(false)
  }

  function getExerciseName(exerciseId: string): string {
    return COMMON_EXERCISES.find(e => e.id === exerciseId)?.name ?? exerciseId
  }

  function formatValue(pr: PR): string {
    if (pr.unit === 'reps') return `${pr.value} reps`
    if (pr.unit === 'kg') return `${pr.value} kg`
    if (pr.unit === 'seconds') return `${pr.value}s`
    return `${pr.value}`
  }

  // Agrupa por exercício mostrando apenas o melhor
  const bestPRs = prs.reduce<Record<string, PR>>((acc, pr) => {
    const key = pr.exercise_id
    if (!acc[key] || pr.value > acc[key].value) {
      acc[key] = pr
    }
    return acc
  }, {})

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-muted rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold">Recordes Pessoais</h1>
              <p className="text-sm text-muted-foreground">
                {Object.keys(bestPRs).length} exercícios
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-sm font-medium hover:text-muted-foreground transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo PR
          </button>
        </div>

        {/* Lista de PRs */}
        {Object.keys(bestPRs).length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center space-y-3 shadow-sm">
            <Trophy className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="font-medium">Nenhum PR registrado</p>
            <p className="text-sm text-muted-foreground">
              Registre seus recordes pessoais para acompanhar sua evolução.
            </p>
            <Button
              variant="outline"
              onClick={() => setShowModal(true)}
            >
              Registrar primeiro PR
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl divide-y divide-border overflow-hidden shadow-sm">
            {Object.values(bestPRs).map(pr => (
              <div key={pr.id} className="flex items-center justify-between px-5 py-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {getExerciseName(pr.exercise_id)}
                  </p>
                  <p className="text-xs text-muted-foreground">{pr.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums">
                    {formatValue(pr)}
                  </p>
                  {pr.notes && (
                    <p className="text-xs text-muted-foreground">{pr.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Histórico completo */}
        {prs.length > Object.keys(bestPRs).length && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              Histórico
            </h2>
            <div className="bg-white rounded-2xl divide-y divide-border overflow-hidden shadow-sm">
              {prs.map(pr => (
                <div key={pr.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {getExerciseName(pr.exercise_id)}
                    </p>
                    <p className="text-xs text-muted-foreground">{pr.date}</p>
                  </div>
                  <p className="text-sm font-medium tabular-nums">
                    {formatValue(pr)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Modal novo PR */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-end">
          <div className="w-full max-w-md mx-auto bg-background border border-border rounded-t-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Novo PR</h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Exercício */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Exercício</label>
              <select
                value={selectedExercise}
                onChange={e => setSelectedExercise(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
              >
                {COMMON_EXERCISES.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
                <option value="custom">Outro exercício...</option>
              </select>
              {selectedExercise === 'custom' && (
                <input
                  type="text"
                  placeholder="Nome do exercício"
                  value={customExercise}
                  onChange={e => setCustomExercise(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
                />
              )}
            </div>

            {/* Valor + Unidade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Valor</label>
                <input
                  type="number"
                  placeholder="Ex: 10"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Unidade</label>
                <select
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
                >
                  {UNITS.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Observações <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Strict, sem kip"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground"
              />
            </div>

            <Button
              className="w-full h-11"
              onClick={handleSave}
              disabled={saving || !value}
            >
              {saving ? 'Salvando...' : 'Salvar PR'}
            </Button>
          </div>
        </div>
      )}

    </div>
  )
}