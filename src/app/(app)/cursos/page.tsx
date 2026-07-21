'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────────────────────

type SkillWithProgress = {
  id: string
  name: string
  description: string | null
  icon: string | null
  order_index: number
  total_videos: number
  watched_videos: number
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CursosPage() {
  const router = useRouter()

  const [skills, setSkills] = useState<SkillWithProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      /**
       * Estratégia: buscar listas base e contadores em queries separadas,
       * evitando joins nested de 3 níveis que o PostgREST pode resolver
       * de forma ambígua quando há FKs compostas envolvidas.
       */
      const [skillsRes, allVideosRes, watchedRes] =
        await Promise.all([
          // Skills (sem nested)
          supabase
            .from('skills')
            .select('id, name, description, icon, order_index')
            .order('order_index'),

          // Total de vídeos por skill
          supabase
            .from('skill_videos')
            .select('id, skill_id'),

          // Vídeos assistidos pelo usuário
          supabase
            .from('user_video_progress')
            .select('video_id')
            .eq('user_id', user.id),
        ])

      // ── Skills com progresso ──────────────────────────────────────────────
      const allVideos = (allVideosRes.data ?? []) as any[]
      const watchedIds = new Set((watchedRes.data ?? []).map((v: any) => v.video_id))

      const skillsWithProgress: SkillWithProgress[] = (skillsRes.data ?? []).map((s: any) => {
        const skillVideos = allVideos.filter((v: any) => v.skill_id === s.id)
        return {
          id: s.id,
          name: s.name,
          description: s.description,
          icon: s.icon,
          order_index: s.order_index,
          total_videos: skillVideos.length,
          watched_videos: skillVideos.filter(v => watchedIds.has(v.id)).length,
        }
      })

      setSkills(skillsWithProgress)
      setLoading(false)
    }

    load()
  }, [])

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
      <div className="max-w-md mx-auto px-4 pt-10 space-y-8">

        {/* Skills */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight">Técnicas</h1>
            <p className="text-sm text-muted-foreground">
              Vídeos educativos por skill com a Coach Thaix
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {skills.map((skill) => {
              const pct = skill.total_videos > 0
                ? Math.round((skill.watched_videos / skill.total_videos) * 100)
                : 0

              return (
                <button
                  key={skill.id}
                  onClick={() => router.push(`/cursos/skills/${skill.id}`)}
                  className="bg-white rounded-2xl p-4 text-left shadow-sm hover:shadow-md transition-all space-y-3"
                >
                  <span className="text-2xl">{skill.icon}</span>
                  <div>
                    <p className="font-extrabold text-sm">{skill.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {skill.total_videos} vídeos
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {pct === 0
                        ? 'Não iniciado'
                        : pct === 100
                        ? '✓ Concluído'
                        : `${skill.watched_videos} de ${skill.total_videos}`}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

      </div>
    </div>
  )
}
