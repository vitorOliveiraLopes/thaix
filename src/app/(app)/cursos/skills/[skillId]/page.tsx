'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Play, CheckCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

type SkillVideo = {
  id: string
  title: string
  description: string | null
  video_url: string | null
  duration_sec: number | null
  order_index: number
  phase: string | null
  watched: boolean
  watch_count: number
}

type Skill = {
  id: string
  name: string
  description: string | null
  icon: string | null
}

function formatDuration(sec: number | null) {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}min ${s}s` : `${m}min`
}

export default function SkillPage() {
  const { skillId } = useParams<{ skillId: string }>()
  const router = useRouter()
  const [skill, setSkill] = useState<Skill | null>(null)
  const [videos, setVideos] = useState<SkillVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVideo, setSelectedVideo] = useState<SkillVideo | null>(null)
  const [marking, setMarking] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [skillRes, videosRes, progressRes] = await Promise.all([
        supabase.from('skills').select('*').eq('id', skillId).single(),
        supabase
          .from('skill_videos')
          .select('*')
          .eq('skill_id', skillId)
          .order('order_index'),
        supabase
          .from('user_video_progress')
          .select('video_id, watch_count')
          .eq('user_id', user.id),
      ])

      const progressMap = new Map(
        (progressRes.data ?? []).map(p => [p.video_id, p.watch_count])
      )

      const videosWithProgress = (videosRes.data ?? []).map((v: SkillVideo & { skill_videos?: { id: string }[] }) => ({
        ...v,
        watched: progressMap.has(v.id),
        watch_count: progressMap.get(v.id) ?? 0,
      }))

      setSkill(skillRes.data)
      setVideos(videosWithProgress)
      setLoading(false)
    }
    load()
  }, [skillId])

  async function handleMarkWatched(video: SkillVideo) {
    setMarking(video.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (!video.watched) {
      await supabase
        .from('user_video_progress')
        .insert({ user_id: user.id, video_id: video.id, watch_count: 1 })

      setVideos(prev => prev.map(v =>
        v.id === video.id ? { ...v, watched: true } : v
      ))
    }
    setMarking(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const watchedCount = videos.filter(v => v.watched).length
  const progress = videos.length > 0 ? Math.round((watchedCount / videos.length) * 100) : 0

  // Agrupar por fase se existir
  const phases = [...new Set(videos.map(v => v.phase).filter(Boolean))]
  const hasPhases = phases.length > 0

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto">

        {/* Header */}
        <div className="px-4 pt-10 pb-6 space-y-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="flex items-center gap-3">
            <span className="text-4xl">{skill?.icon}</span>
            <div>
              <h1 className="text-2xl font-extrabold">{skill?.name}</h1>
              {skill?.description && (
                <p className="text-sm text-muted-foreground">{skill.description}</p>
              )}
            </div>
          </div>

          {/* Progresso geral */}
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-semibold">Seu progresso</span>
              <span className="text-muted-foreground">{watchedCount} de {videos.length} vídeos</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Player de vídeo selecionado */}
        {selectedVideo && (
          <div className="px-4 mb-4">
            <div className="bg-foreground rounded-2xl overflow-hidden">
              {selectedVideo.video_url ? (
                selectedVideo.video_url.includes('youtube.com') || selectedVideo.video_url.includes('youtu.be') ? (
                  <iframe
                    src={selectedVideo.video_url}
                    className="w-full aspect-video"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                ) : (
                  <video
                    src={selectedVideo.video_url}
                    controls
                    className="w-full aspect-video"
                    onEnded={() => handleMarkWatched(selectedVideo)}
                  />
                )
              ) : (
                <div className="w-full aspect-video flex items-center justify-center">
                  <p className="text-white/50 text-sm">Vídeo em breve</p>
                </div>
              )}
              <div className="p-4 space-y-2">
                <p className="text-white font-extrabold">{selectedVideo.title}</p>
                {selectedVideo.description && (
                  <p className="text-white/70 text-sm">{selectedVideo.description}</p>
                )}
                <button
                  onClick={() => handleMarkWatched(selectedVideo)}
                  disabled={!!marking}
                  className={cn(
                    'w-full h-11 rounded-full font-bold text-sm transition-all mt-2',
                    selectedVideo.watched
                      ? 'bg-white/10 text-white/70 flex items-center justify-center gap-2'
                      : 'bg-primary text-white'
                  )}
                >
                  {selectedVideo.watched ? (
                    <><RotateCcw className="w-4 h-4" /> Rever</>
                  ) : (
                    'Marcar como assistido'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de vídeos */}
        <div className="px-4 space-y-2">
          {hasPhases ? (
            phases.map(phase => (
              <div key={phase} className="space-y-2">
                <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase px-1">
                  {phase}
                </p>
                {videos.filter(v => v.phase === phase).map(video => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    isSelected={selectedVideo?.id === video.id}
                    onSelect={() => setSelectedVideo(video)}
                    onMark={() => handleMarkWatched(video)}
                    marking={marking === video.id}
                  />
                ))}
              </div>
            ))
          ) : (
            videos.map(video => (
              <VideoCard
                key={video.id}
                video={video}
                isSelected={selectedVideo?.id === video.id}
                onSelect={() => setSelectedVideo(video)}
                onMark={() => handleMarkWatched(video)}
                marking={marking === video.id}
              />
            ))
          )}
        </div>

      </div>
    </div>
  )
}

function VideoCard({ video, isSelected, onSelect, onMark, marking }: {
  video: SkillVideo
  isSelected: boolean
  onSelect: () => void
  onMark: () => void
  marking: boolean
}) {
  return (
    <div className={cn(
      'bg-white rounded-2xl overflow-hidden shadow-sm transition-all',
      isSelected && 'ring-2 ring-primary'
    )}>
      <button onClick={onSelect} className="w-full flex items-center gap-3 p-4 text-left">
        {/* Thumbnail / play */}
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
          video.watched ? 'bg-primary/10' : 'bg-muted'
        )}>
          {video.watched
            ? <CheckCircle className="w-6 h-6 text-primary" />
            : <Play className="w-5 h-5 text-muted-foreground" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-bold leading-tight', video.watched && 'text-primary')}>
            {video.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {video.duration_sec && (
              <span className="text-xs text-muted-foreground">{formatDuration(video.duration_sec)}</span>
            )}
          </div>
        </div>
      </button>
    </div>
  )
}
