'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Session, SessionItem, Exercise, UserProgress } from '@/types/database'

export type HomeData = {
  profile: Profile | null
  progress: UserProgress | null
  todaySession: Session | null
  sessionItems: (SessionItem & { exercise: Exercise })[]
  hydrationToday: boolean
  streakCount: number
  loading: boolean
  error: string | null
}

export function useHomeData(): HomeData {
  const [data, setData] = useState<HomeData>({
    profile: null,
    progress: null,
    todaySession: null,
    sessionItems: [],
    hydrationToday: false,
    streakCount: 0,
    loading: true,
    error: null,
  })

  useEffect(() => {
    async function fetchAll() {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setData(d => ({ ...d, loading: false, error: 'Não autenticado' })); return }

      // Busca em paralelo: perfil, progresso e hidratação de hoje
      const today = new Date().toISOString().split('T')[0]

      const [profileRes, progressRes, hydrationRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('user_protocol_progress').select('*').eq('user_id', user.id).single(),
        supabase.from('hydration_days').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
      ])

      const profile = profileRes.data
      const progress = progressRes.data

      if (!progress) {
        setData(d => ({ ...d, loading: false, error: 'Progresso não encontrado' }))
        return
      }

      // Busca a sessão do dia atual
      const sessionId = `${progress.active_protocol_id}-${progress.current_phase_id.split('-').pop()}-dia-${progress.current_day_number}`

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      // Busca os itens da sessão com os exercícios
      let sessionItems: (SessionItem & { exercise: Exercise })[] = []
      if (sessionData) {
        const { data: items } = await supabase
          .from('session_items')
          .select('*, exercise:exercises(*)')
          .eq('session_id', sessionData.id)
          .order('order_index')

        sessionItems = (items ?? []) as (SessionItem & { exercise: Exercise })[]
      }

      // Calcula streak — dias consecutivos com treino concluído
      const { data: workouts } = await supabase
        .from('workouts_completed')
        .select('completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(60)

      const streakCount = calculateStreak(workouts ?? [])

      setData({
        profile,
        progress,
        todaySession: sessionData ?? null,
        sessionItems,
        hydrationToday: hydrationRes.data?.met_goal ?? false,
        streakCount,
        loading: false,
        error: null,
      })
    }

    fetchAll()
  }, [])

  return data
}

function calculateStreak(workouts: { completed_at: string }[]): number {
  if (workouts.length === 0) return 0

  const days = [...new Set(
    workouts.map(w => w.completed_at.split('T')[0])
  )].sort().reverse()

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // Streak só conta se treinou hoje ou ontem
  if (days[0] !== today && days[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1])
    const curr = new Date(days[i])
    const diff = (prev.getTime() - curr.getTime()) / 86400000
    if (diff === 1) streak++
    else break
  }

  return streak
}