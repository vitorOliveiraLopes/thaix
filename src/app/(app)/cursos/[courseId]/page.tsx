'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Play, CheckCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

type Lesson = {
  id: string
  lesson_number: number
  title: string
  duration_seconds: number | null
  description: string | null
  completed: boolean
}

type Module = {
  id: string
  module_number: number
  title: string
  lessons: Lesson[]
}

type Course = {
  id: string
  title: string
  eyebrow: string | null
  description: string | null
}

export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>()
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [courseRes, completedRes] = await Promise.all([
        supabase
          .from('courses')
          .select(`
            id, title, eyebrow, description,
            course_modules (
              id, module_number, title,
              course_lessons (
                id, lesson_number, title, duration_seconds, description
              )
            )
          `)
          .eq('id', courseId)
          .single(),
        supabase
          .from('course_lessons_completed')
          .select('lesson_id')
          .eq('user_id', user.id),
      ])

      const completedIds = new Set((completedRes.data ?? []).map(c => c.lesson_id))
      const raw = courseRes.data

      if (!raw) return

      setCourse({
        id: raw.id,
        title: raw.title,
        eyebrow: raw.eyebrow,
        description: raw.description,
      })

      const sortedModules = [...(raw.course_modules as any[])]
        .sort((a, b) => a.module_number - b.module_number)
        .map(mod => ({
          id: mod.id,
          module_number: mod.module_number,
          title: mod.title,
          lessons: [...(mod.course_lessons as any[])]
            .sort((a, b) => a.lesson_number - b.lesson_number)
            .map(lesson => ({
              ...lesson,
              completed: completedIds.has(lesson.id),
            })),
        }))

      setModules(sortedModules)
      setLoading(false)
    }
    load()
  }, [courseId])

  async function handleToggleLesson(lessonId: string, isCompleted: boolean) {
    setCompleting(lessonId)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (isCompleted) {
      await supabase
        .from('course_lessons_completed')
        .delete()
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId)
    } else {
      await supabase
        .from('course_lessons_completed')
        .upsert({ user_id: user.id, lesson_id: lessonId },
          { onConflict: 'user_id,lesson_id' })
    }

    setModules(prev => prev.map(mod => ({
      ...mod,
      lessons: mod.lessons.map(l =>
        l.id === lessonId ? { ...l, completed: !isCompleted } : l
      ),
    })))

    setCompleting(null)
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds) return ''
    const min = Math.floor(seconds / 60)
    return `${min} min`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalLessons = modules.flatMap(m => m.lessons).length
  const completedLessons = modules.flatMap(m => m.lessons).filter(l => l.completed).length
  const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

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
          <div className="flex-1">
            {course?.eyebrow && (
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                {course.eyebrow}
              </p>
            )}
            <h1 className="text-xl font-semibold leading-tight">{course?.title}</h1>
          </div>
        </div>

        {/* Progresso */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Seu progresso</span>
            <span className="font-medium">{completedLessons} de {totalLessons} aulas</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Módulos e aulas */}
        <div className="space-y-4">
          {modules.map((mod) => (
            <div key={mod.id} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest px-1">
                Módulo {mod.module_number} — {mod.title}
              </h2>

              <div className="border rounded-2xl divide-y divide-border overflow-hidden">
                {mod.lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex items-center gap-4 px-5 py-4"
                  >
                    <button
                      onClick={() => handleToggleLesson(lesson.id, lesson.completed)}
                      disabled={completing === lesson.id}
                      className="flex-shrink-0"
                    >
                      <CheckCircle className={cn(
                        'w-5 h-5 transition-colors',
                        lesson.completed
                          ? 'text-foreground'
                          : 'text-muted-foreground/30'
                      )} />
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium leading-tight',
                        lesson.completed && 'line-through text-muted-foreground'
                      )}>
                        {lesson.lesson_number}. {lesson.title}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {lesson.duration_seconds && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(lesson.duration_seconds)}
                          </span>
                        )}
                        {lesson.description && (
                          <span className="text-xs text-muted-foreground truncate">
                            {lesson.description}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 h-8 w-8 p-0"
                      onClick={() => handleToggleLesson(lesson.id, lesson.completed)}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}