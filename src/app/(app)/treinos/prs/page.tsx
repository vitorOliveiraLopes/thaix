'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, X, Trophy, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type PR = {
  id: string
  exercise_id: string   // skill_exercise_id ou id personalizado
  exercise_name: string // resolvido na query ou fallback ao id
  value: number
  unit: string
  date: string
  notes: string | null
  auto: boolean         // true = registrado automaticamente por completeWorkout
}

type SkillExercise = {
  id: string
  exercise_name: string
  skill_id: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const UNITS = [
  { value: 'reps',    label: 'Repetições' },
  { value: 'kg',      label: 'Quilogramas (kg)' },
  { value: 'seconds', label: 'Segundos' },
]

const SKILL_NAMES: Record<string, string> = {
  'pull-up': 'Pull-up', 'c2b': 'Chest to Bar',
  'bmu': 'Bar Muscle-up', 't2b': 'Toes-to-Bar', 'hspu': 'HSPU',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatValue(value: number, unit: string): string {
  if (unit === 'reps') return `${value} reps`
  if (unit === 'kg') return `${value} kg`
  if (unit === 'seconds') return `${value}s`
  return `${value}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PRsPage() {
  const router = useRouter()
  const [prs, setPrs] = useState<PR[]>([])
  const [skillExercises, setSkillExercises] = useState<SkillExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [selectedExercise, setSelectedExercise] = useState('')
  const [customExercise, setCustomExercise] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('reps')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [prsRes, exercisesRes] = await Promise.all([
      supabase
        .from('pr_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false }),
      // Carregar exercícios reais das skills para o formulário manual
      supabase
        .from('skill_exercises')
        .select('id, exercise_name, skill_id')
        .order('skill_id')
        .order('exercise_name'),
    ])

    const exercises = (exercisesRes.data ?? []) as SkillExercise[]
    setSkillExercises(exercises)

    // Resolver nomes dos exercícios nos PRs
    const exerciseNameMap = new Map(exercises.map(e => [e.id, e.exercise_name]))

    const resolvedPRs: PR[] = (prsRes.data ?? []).map((pr: any) => ({
      id: pr.id,
      exercise_id: pr.exercise_id,
      exercise_name: exerciseNameMap.get(pr.exercise_id) ?? pr.exercise_id,
      value: pr.value,
      unit: pr.unit,
      date: pr.date,
      notes: pr.notes,
      auto: pr.notes === 'Registrado automaticamente',
    }))

    setPrs(resolvedPRs)
    if (exercises.length > 0 && !selectedExercise) {
      setSelectedExercise(exercises[0].id)
    }
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

    await supabase.from('pr_entries').insert({
      user_id: user.id,
      exercise_id: exerciseId,
      value: numValue,
      unit,
      date: new Date().toISOString().split('T')[0],
      notes: notes.trim() || null,
    })

    setShowModal(false)
    setValue('')
    setNotes('')
    setCustomExercise('')
    setUnit('reps')
    setSaving(false)
    await loadAll()
  }

  // ─── Derivados ────────────────────────────────────────────────────────────

  // Melhor PR por (exercise_id, unit)
  const bestPRs = prs.reduce<Map<string, PR>>((acc, pr) => {
    const key = `${pr.exercise_id}|${pr.unit}`
    const existing = acc.get(key)
    if (!existing || pr.value > existing.value) acc.set(key, pr)
    return acc
  }, new Map())

  const bestList = [...bestPRs.values()].sort((a, b) =>
    a.exercise_name.localeCompare(b.exercise_name)
  )

  // PRs que não são o melhor (histórico)
  const historyList = prs.filter(pr => {
    const key = `${pr.exercise_id}|${pr.unit}`
    return bestPRs.get(key)?.id !== pr.id
  })

  // Exercícios agrupados por skill para o select
  const exercisesBySkill = skillExercises.reduce<Record<string, SkillExercise[]>>(
    (acc, e) => {
      acc[e.skill_id] ??= []
      acc[e.skill_id].push(e)
      return acc
    },
    {}
  )

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

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
              <h1 className="text-xl font-extrabold">Recordes Pessoais</h1>
              <p className="text-sm text-muted-foreground">
                {bestList.length} {bestList.length === 1 ? 'exercício' : 'exercícios'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo PR
          </button>
        </div>

        {/* Empty state */}
        {bestList.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center space-y-3 shadow-sm">
            <Trophy className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="font-bold">Nenhum PR ainda</p>
            <p className="text-sm text-muted-foreground">
              Complete treinos para registrar recordes automáticos, ou adicione manualmente.
            </p>
            <Button variant="outline" onClick={() => setShowModal(true)}>
              Registrar PR manualmente
            </Button>
          </div>
        ) : (
          <>
            {/* Melhores PRs */}
            <div className="bg-white rounded-2xl divide-y divide-border overflow-hidden shadow-sm">
              {bestList.map(pr => (
                <div key={pr.id} className="flex items-center justify-between px-5 py-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{pr.exercise_name}</p>
                      {pr.auto && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary">
                          <Zap className="w-2.5 h-2.5" />
                          Auto
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(pr.date)}</p>
                    {pr.notes && !pr.auto && (
                      <p className="text-xs text-muted-foreground">{pr.notes}</p>
                    )}
                  </div>
                  <p className="text-xl font-extrabold tabular-nums text-primary">
                    {formatValue(pr.value, pr.unit)}
                  </p>
                </div>
              ))}
            </div>

            {/* Histórico */}
            {historyList.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                  Histórico
                </h2>
                <div className="bg-white rounded-2xl divide-y divide-border overflow-hidden shadow-sm">
                  {historyList.map(pr => (
                    <div
                      key={pr.id}
                      className="flex items-center justify-between px-5 py-3 opacity-70"
                    >
                      <div>
                        <p className="text-sm font-medium">{pr.exercise_name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(pr.date)}</p>
                      </div>
                      <p className="text-sm font-medium tabular-nums">
                        {formatValue(pr.value, pr.unit)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

      </div>

      {/* Modal novo PR */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-end">
          <div className="w-full max-w-md mx-auto bg-background border border-border rounded-t-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold">Novo PR</h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Exercício */}
            <div className="space-y-2">
              <label className="text-sm font-bold">Exercício</label>
              <select
                value={selectedExercise}
                onChange={e => setSelectedExercise(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Object.entries(exercisesBySkill).map(([skillId, exercises]) => (
                  <optgroup key={skillId} label={SKILL_NAMES[skillId] ?? skillId}>
                    {exercises.map(e => (
                      <option key={e.id} value={e.id}>{e.exercise_name}</option>
                    ))}
                  </optgroup>
                ))}
                <option value="custom">Outro exercício...</option>
              </select>
              {selectedExercise === 'custom' && (
                <input
                  type="text"
                  placeholder="Nome do exercício"
                  value={customExercise}
                  onChange={e => setCustomExercise(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              )}
            </div>

            {/* Valor + Unidade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-bold">Valor</label>
                <input
                  type="number"
                  placeholder="Ex: 10"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">Unidade</label>
                <select
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {UNITS.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <label className="text-sm font-bold">
                Observações{' '}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Strict, sem kip"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
