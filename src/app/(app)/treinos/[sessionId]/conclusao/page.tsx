'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { Session } from '@/types/database'

export default function ConclusaoPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const nav = document.querySelector('nav')
    if (nav) nav.style.display = 'none'
    return () => {
      if (nav) nav.style.display = ''
    }
  }, [])

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId as string)
        .single()

      setSession(sessionData)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: workouts } = await supabase
        .from('workouts_completed')
        .select('completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(60)

      if (workouts) {
        const days = [...new Set(
          workouts.map(w => w.completed_at.split('T')[0])
        )].sort().reverse()

        let s = 1
        for (let i = 1; i < days.length; i++) {
          const prev = new Date(days[i - 1])
          const curr = new Date(days[i])
          if ((prev.getTime() - curr.getTime()) / 86400000 === 1) s++
          else break
        }
        setStreak(s)
      }
    }
    load()
  }, [sessionId])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center max-w-sm mx-auto">

      <div className="text-6xl mb-6">🏆</div>

      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          Treino concluído!
        </h1>
        <p className="text-muted-foreground">
          {session?.title ?? 'Sessão finalizada'}
        </p>
      </div>

      <div className="w-full bg-muted rounded-2xl p-6 mb-8 space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Duração estimada</span>
          <span className="font-medium">~{session?.estimated_minutes ?? 0} min</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Sequência atual</span>
          <span className="font-medium">
            🔥 {streak} {streak === 1 ? 'dia' : 'dias'}
          </span>
        </div>
      </div>

      <div className="w-full space-y-3">
        <Button
          className="w-full h-12 text-base"
          onClick={() => router.push('/home')}
        >
          Voltar para home
        </Button>
      </div>

    </div>
  )
}