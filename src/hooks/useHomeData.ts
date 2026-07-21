'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────────────────────

export type HomeProfile = {
  user_id: string
  name: string | null          // coluna real em profiles é 'name', não 'full_name'
  avatar_url: string | null
  hydration_goal_ml: number | null
}

export type HomeData = {
  profile: HomeProfile | null
  hydrationToday: boolean
  streakCount: number
  loading: boolean
  error: string | null
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useHomeData(): HomeData {
  const [data, setData] = useState<HomeData>({
    profile: null,
    hydrationToday: false,
    streakCount: 0,
    loading: true,
    error: null,
  })

  useEffect(() => {
    async function fetchAll() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setData(d => ({ ...d, loading: false, error: 'Não autenticado' }))
        return
      }

      const today = new Date().toISOString().split('T')[0]

      const [profileRes, hydrationRes, workoutsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, name, avatar_url, hydration_goal_ml') // 'name' não 'full_name'
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('hydration_days')
          .select('met_goal')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle(),
        supabase
          .from('daily_workouts')
          .select('date')
          .eq('user_id', user.id)
          .not('completed_at', 'is', null)
          .order('date', { ascending: false })
          .limit(90),
      ])

      setData({
        profile: profileRes.data,
        hydrationToday: hydrationRes.data?.met_goal ?? false,
        streakCount: calculateStreak(workoutsRes.data ?? []),
        loading: false,
        error: null,
      })
    }

    fetchAll()
  }, [])

  return data
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateStreak(records: { date: string }[]): number {
  if (records.length === 0) return 0

  const days = [...new Set(records.map(r => r.date))].sort().reverse()
  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]

  if (days[0] !== today && days[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < days.length; i++) {
    const diff =
      (new Date(days[i - 1]).getTime() - new Date(days[i]).getTime()) / 86_400_000
    if (diff === 1) streak++
    else break
  }
  return streak
}
