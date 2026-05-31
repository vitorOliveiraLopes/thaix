'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type Achievement = {
  id: string
  type: 'session_count' | 'exercise'
  name: string
  description: string | null
  threshold: number | null
  exercise_id: string | null
  display_type: string
  unlocked: boolean
  unlocked_at: string | null
}

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
        (unlockedRes.data ?? []).map(u => [u.achievement_id, u.unlocked_at])
      )

      const merged = (achievementsRes.data ?? []).map(a => ({
        ...a,
        unlocked: unlockedMap.has(a.id),
        unlocked_at: unlockedMap.get(a.id) ?? null,
      }))

      setAchievements(merged)
      setLoading(false)
    }
    load()
  }, [])

  const sessionAchievements = achievements.filter(a => a.type === 'session_count')
  const exerciseAchievements = achievements.filter(a => a.type === 'exercise')
  const totalUnlocked = achievements.filter(a => a.unlocked).length

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
            <h1 className="text-xl font-semibold">Conquistas</h1>
            <p className="text-sm text-muted-foreground">
              {totalUnlocked} de {achievements.length} desbloqueadas
            </p>
          </div>
        </div>

        {/* Barra de progresso geral */}
        <div className="space-y-2">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground rounded-full transition-all"
              style={{ width: `${achievements.length > 0 ? (totalUnlocked / achievements.length) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {achievements.length > 0
              ? Math.round((totalUnlocked / achievements.length) * 100)
              : 0}% completo
          </p>
        </div>

        {/* Conquistas de treinos */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
            Treinos concluídos
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {sessionAchievements.map(a => (
              <div
                key={a.id}
                className={cn(
                  'border rounded-2xl p-4 flex flex-col items-center gap-2 text-center',
                  a.unlocked ? 'border-foreground' : 'opacity-40'
                )}
              >
                <span className="text-2xl">
                  {a.unlocked ? '🏆' : '🔒'}
                </span>
                <div>
                  <p className="text-xs font-semibold leading-tight">{a.name}</p>
                  {a.threshold && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.threshold} treinos
                    </p>
                  )}
                </div>
                {a.unlocked && a.unlocked_at && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.unlocked_at).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Conquistas de exercícios */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
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
                  <p className="text-sm font-medium">{a.name}</p>
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
        </div>

      </div>
    </div>
  )
}