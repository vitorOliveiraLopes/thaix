'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type WorkoutDay = {
  date: string
  session_id: string | null
}

type WeightLog = {
  date: string
  weight_kg: number
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
  weightLogs: WeightLog[]
  painLogs: PainLog[]
  hydrationDays: HydrationDay[]
  totalWorkouts: number
  currentStreak: number
  maxStreak: number
  totalMinutes: number
  loading: boolean
}

export function useProgressData() {
  const [data, setData] = useState<ProgressData>({
    workoutDays: [],
    weightLogs: [],
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

      const [workoutsRes, weightRes, painRes, hydrationRes] = await Promise.all([
        supabase
          .from('workouts_completed')
          .select('completed_at, session_id')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false }),
        supabase
          .from('weight_logs')
          .select('date, weight_kg')
          .eq('user_id', user.id)
          .order('date', { ascending: true }),
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

      const workouts = workoutsRes.data ?? []
      const workoutDays: WorkoutDay[] = workouts.map(w => ({
        date: w.completed_at.split('T')[0],
        session_id: w.session_id,
      }))

      const uniqueDays = [...new Set(workoutDays.map(w => w.date))].sort().reverse()
      const currentStreak = calculateStreak(uniqueDays)
      const maxStreak = calculateMaxStreak(uniqueDays)
      const totalMinutes = workouts.length * 25

      setData({
        workoutDays,
        weightLogs: (weightRes.data ?? []) as WeightLog[],
        painLogs: (painRes.data ?? []) as PainLog[],
        hydrationDays: (hydrationRes.data ?? []) as HydrationDay[],
        totalWorkouts: workouts.length,
        currentStreak,
        maxStreak,
        totalMinutes,
        loading: false,
      })
    }
    load()
  }, [])

  return data
}

function calculateStreak(sortedDaysDesc: string[]): number {
  if (sortedDaysDesc.length === 0) return 0
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (sortedDaysDesc[0] !== today && sortedDaysDesc[0] !== yesterday) return 0
  let streak = 1
  for (let i = 1; i < sortedDaysDesc.length; i++) {
    const prev = new Date(sortedDaysDesc[i - 1])
    const curr = new Date(sortedDaysDesc[i])
    if ((prev.getTime() - curr.getTime()) / 86400000 === 1) streak++
    else break
  }
  return streak
}

function calculateMaxStreak(sortedDaysDesc: string[]): number {
  if (sortedDaysDesc.length === 0) return 0
  let max = 1
  let current = 1
  const days = [...sortedDaysDesc].reverse()
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1])
    const curr = new Date(days[i])
    if ((curr.getTime() - prev.getTime()) / 86400000 === 1) {
      current++
      max = Math.max(max, current)
    } else {
      current = 1
    }
  }
  return max
}