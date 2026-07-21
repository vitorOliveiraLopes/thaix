'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────────────────────

type WorkoutDay = {
  date: string
}

type PainLog = {
  date: string
  pain_score: number
}

type HydrationDay = {
  date: string
  met_goal: boolean
}

export type ProgressData = {
  workoutDays: WorkoutDay[]
  painLogs: PainLog[]
  hydrationDays: HydrationDay[]
  totalWorkouts: number
  currentStreak: number
  maxStreak: number
  totalMinutes: number
  loading: boolean
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useProgressData(): ProgressData {
  const [data, setData] = useState<ProgressData>({
    workoutDays: [],
    painLogs: [],
    hydrationDays: [],
    totalWorkouts: 0,
    currentStreak: 0,
    maxStreak: 0,
    totalMinutes: 0,
    loading: true,
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [workoutsRes, painRes, hydrationRes] = await Promise.all([
        // Fonte de verdade: daily_workouts com completed_at preenchido
        supabase
          .from('daily_workouts')
          .select('date, skill_id')
          .eq('user_id', user.id)
          .not('completed_at', 'is', null)
          .order('date', { ascending: false }),
        supabase
          .from('daily_pain_logs')
          .select('date, pain_score')
          .eq('user_id', user.id)
          .order('date', { ascending: true }),
        supabase
          .from('hydration_days')
          .select('date, met_goal')
          .eq('user_id', user.id)
          .order('date', { ascending: false }),
      ])

      const workouts = (workoutsRes.data ?? []) as any[]
      // Dias únicos de treino (um dia pode ter 2 skills)
      const uniqueDays = [...new Set(workouts.map((w: any) => w.date))].sort().reverse()

      setData({
        workoutDays: uniqueDays.map(date => ({ date })),
        painLogs: (painRes.data ?? []) as PainLog[],
        hydrationDays: (hydrationRes.data ?? []) as HydrationDay[],
        totalWorkouts: workouts.length,
        currentStreak: calculateStreak(uniqueDays),
        maxStreak: calculateMaxStreak(uniqueDays),
        // Estimativa de 25 min por treino de skill
        totalMinutes: workouts.length * 25,
        loading: false,
      })
    }

    load()
  }, [])

  return data
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateStreak(sortedDaysDesc: string[]): number {
  if (sortedDaysDesc.length === 0) return 0
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
  if (sortedDaysDesc[0] !== today && sortedDaysDesc[0] !== yesterday) return 0
  let streak = 1
  for (let i = 1; i < sortedDaysDesc.length; i++) {
    const diff =
      (new Date(sortedDaysDesc[i - 1]).getTime() - new Date(sortedDaysDesc[i]).getTime()) /
      86_400_000
    if (diff === 1) streak++
    else break
  }
  return streak
}

function calculateMaxStreak(sortedDaysDesc: string[]): number {
  if (sortedDaysDesc.length === 0) return 0
  const days = [...sortedDaysDesc].reverse()
  let max = 1
  let current = 1
  for (let i = 1; i < days.length; i++) {
    const diff =
      (new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86_400_000
    if (diff === 1) {
      max = Math.max(max, ++current)
    } else {
      current = 1
    }
  }
  return max
}
