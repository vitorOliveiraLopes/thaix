'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, Clock, ChevronRight } from 'lucide-react'

type CourseWithProgress = {
  id: string
  title: string
  eyebrow: string | null
  description: string | null
  total_lessons: number
  completed_lessons: number
}

export default function CursosPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<CourseWithProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Busca cursos com módulos e aulas
      const { data: coursesData } = await supabase
        .from('courses')
        .select(`
          id, title, eyebrow, description,
          course_modules (
            course_lessons ( id )
          )
        `)
        .eq('available', true)
        .order('order_index')

      // Busca aulas concluídas pelo aluno
      const { data: completedData } = await supabase
        .from('course_lessons_completed')
        .select('lesson_id')
        .eq('user_id', user.id)

      const completedIds = new Set((completedData ?? []).map(c => c.lesson_id))

      const withProgress = (coursesData ?? []).map((course: any) => {
        const allLessons = course.course_modules.flatMap((m: any) => m.course_lessons)
        const totalLessons = allLessons.length
        const completedLessons = allLessons.filter((l: any) => completedIds.has(l.id)).length
        return {
          id: course.id,
          title: course.title,
          eyebrow: course.eyebrow,
          description: course.description,
          total_lessons: totalLessons,
          completed_lessons: completedLessons,
        }
      })

      setCourses(withProgress)
      setLoading(false)
    }
    load()
  }, [])

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

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Cursos</h1>
          <p className="text-sm text-muted-foreground">
            Aprenda as técnicas com a Coach Aurora
          </p>
        </div>

        <div className="space-y-3">
          {courses.map((course) => {
            const progress = course.total_lessons > 0
              ? Math.round((course.completed_lessons / course.total_lessons) * 100)
              : 0
            const isStarted = course.completed_lessons > 0
            const isCompleted = course.completed_lessons === course.total_lessons && course.total_lessons > 0

            return (
              <button
                key={course.id}
                onClick={() => router.push(`/cursos/${course.id}`)}
                className="w-full border rounded-2xl p-5 text-left space-y-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    {course.eyebrow && (
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                        {course.eyebrow}
                      </p>
                    )}
                    <h3 className="font-semibold leading-tight">{course.title}</h3>
                    {course.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {course.description}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{course.total_lessons} aulas</span>
                    </div>
                    <span>
                      {isCompleted
                        ? '✓ Concluído'
                        : isStarted
                        ? `${course.completed_lessons} de ${course.total_lessons} aulas`
                        : 'Não iniciado'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </button>
            )
          })}
        </div>

      </div>
    </div>
  )
}