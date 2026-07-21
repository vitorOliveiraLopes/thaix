'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type Achievement = {
  id: string
  type: 'session_count' | 'skill_exercise' | 'skill_level'
  name: string
  description: string | null
  threshold: number | null
  skill_exercise_id: string | null
  skill_id: string | null
  target_level: string | null
  unlocked: boolean
  unlocked_at: string | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SKILL_ICONS: Record<string, string> = {
  'pull-up': '🏋️', 'c2b': '💥', 'bmu': '🥇', 't2b': '✨', 'hspu': '🤸',
}
const SKILL_NAMES: Record<string, string> = {
  'pull-up': 'Pull-up', 'c2b': 'Chest to Bar',
  'bmu': 'Bar Muscle-up', 't2b': 'Toes-to-Bar', 'hspu': 'HSPU',
}
const LEVEL_LABELS: Record<string, string> = {
  intermediario: 'Intermediário', avancado: 'Avançado',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ConquistasPage() {
  const router = useRouter()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [achievementsRes, unlockedRes] = await Promise.all([
        supabase
          .from('achievements')
          .select('*')
          .order('type')
          .order('threshold', { nullsFirst: false }),
        supabase
          .from('user_achievements')
          .select('achievement_id, unlocked_at')
          .eq('user_id', user.id),
      ])

      const unlockedMap = new Map(
        (unlockedRes.data ?? []).map((u: any) => [u.achievement_id, u.unlocked_at])
      )

      const merged: Achievement[] = (achievementsRes.data ?? []).map((a: any) => ({
        ...a,
        unlocked: unlockedMap.has(a.id),
        unlocked_at: unlockedMap.get(a.id) ?? null,
      }))

      setAchievements(merged)
      setLoading(false)
    }
    load()
  }, [])

  // ─── Agrupamentos ─────────────────────────────────────────────────────────

  const sessionAchievements = achievements.filter(a => a.type === 'session_count')
  const exerciseAchievements = achievements.filter(a => a.type === 'skill_exercise')
  const levelAchievements = achievements.filter(a => a.type === 'skill_level')
  const totalUnlocked = achievements.filter(a => a.unlocked).length

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
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-muted rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold">Conquistas</h1>
            <p className="text-sm text-muted-foreground">
              {totalUnlocked} de {achievements.length} desbloqueadas
            </p>
          </div>
        </div>

        {/* Barra geral */}
        <div className="space-y-1.5">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{
                width: `${achievements.length > 0 ? (totalUnlocked / achievements.length) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {achievements.length > 0
              ? Math.round((totalUnlocked / achievements.length) * 100)
              : 0}% completo
          </p>
        </div>

        {/* ── Treinos concluídos ─────────────────────────────────────────── */}
        {sessionAchievements.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-primary uppercase">
              Treinos concluídos
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {sessionAchievements.map(a => (
                <div
                  key={a.id}
                  className={cn(
                    'bg-white border rounded-2xl p-4 flex flex-col items-center gap-2 text-center shadow-sm transition-opacity',
                    !a.unlocked && 'opacity-40'
                  )}
                >
                  <span className="text-2xl">{a.unlocked ? '🏆' : '🔒'}</span>
                  <div>
                    <p className="text-xs font-bold leading-tight">{a.name}</p>
                    {a.threshold && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.threshold} treinos
                      </p>
                    )}
                  </div>
                  {a.unlocked && a.unlocked_at && (
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(a.unlocked_at).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Avanços de nível ──────────────────────────────────────────── */}
        {levelAchievements.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-primary uppercase">
              Progressão de skill
            </h2>
            <div className="bg-white rounded-2xl divide-y divide-border overflow-hidden shadow-sm">
              {levelAchievements.map(a => (
                <div
                  key={a.id}
                  className={cn(
                    'flex items-center gap-4 px-5 py-3.5',
                    !a.unlocked && 'opacity-40'
                  )}
                >
                  <span className="text-xl flex-shrink-0">
                    {a.unlocked ? SKILL_ICONS[a.skill_id ?? ''] ?? '⭐' : '🔒'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {SKILL_NAMES[a.skill_id ?? ''] ?? a.skill_id}
                      {a.target_level ? ` → ${LEVEL_LABELS[a.target_level]}` : ''}
                    </p>
                  </div>
                  {a.unlocked && a.unlocked_at && (
                    <p className="text-xs text-muted-foreground flex-shrink-0">
                      {new Date(a.unlocked_at).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Exercícios executados ─────────────────────────────────────── */}
        {exerciseAchievements.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-primary uppercase">
              Exercícios desbloqueados
            </h2>
            <div className="bg-white rounded-2xl divide-y divide-border overflow-hidden shadow-sm">
              {exerciseAchievements.map(a => (
                <div
                  key={a.id}
                  className={cn(
                    'flex items-center gap-4 px-5 py-3.5',
                    !a.unlocked && 'opacity-40'
                  )}
                >
                  <span className="text-lg flex-shrink-0">
                    {a.unlocked ? '✅' : '🔒'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{a.name}</p>
                    {a.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {a.description}
                      </p>
                    )}
                  </div>
                  {a.unlocked && a.unlocked_at && (
                    <p className="text-xs text-muted-foreground flex-shrink-0">
                      {new Date(a.unlocked_at).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
