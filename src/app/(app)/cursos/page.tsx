'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type SkillWithProgress = {
  id: string
  name: string
  description: string | null
  icon: string | null
  order_index: number
  total_videos: number
  watched_videos: number
}

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
  const [skills, setSkills] = useState<SkillWithProgress[]>([])
  const [courses, setCourses] = useState<CourseWithProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [skillsRes, videosWatchedRes, coursesRes, completedRes] = await Promise.all([
        supabase
          .from('skills')
          .select('id, name, description, icon, order_index, skill_videos(id)')
          .order('order_index'),
        supabase
          .from('user_video_progress')
          .select('video_id')
          .eq('user_id', user.id),
        supabase
          .from('courses')
          .select('id, title, eyebrow, description, course_modules(course_lessons(id))')
          .eq('available', true)
          .order('order_index'),
        supabase
          .from('course_lessons_completed')
          .select('lesson_id')
          .eq('user_id', user.id),
      ])

      const watchedIds = new Set((videosWatchedRes.data ?? []).map(v => v.video_id))

      const skillsWithProgress = (skillsRes.data ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        icon: s.icon,
        order_index: s.order_index,
        total_videos: s.skill_videos.length,
        watched_videos: s.skill_videos.filter((v: any) => watchedIds.has(v.id)).length,
      }))

      const completedIds = new Set((completedRes.data ?? []).map(c => c.lesson_id))
      const coursesWithProgress = (coursesRes.data ?? []).map((c: any) => {
        const allLessons = c.course_modules.flatMap((m: any) => m.course_lessons)
        return {
          id: c.id,
          title: c.title,
          eyebrow: c.eyebrow,
          description: c.description,
          total_lessons: allLessons.length,
          completed_lessons: allLessons.filter((l: any) => completedIds.has(l.id)).length,
        }
      })

      setSkills(skillsWithProgress)
      setCourses(coursesWithProgress)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto px-4 pt-10 space-y-8">

        {/* Skills */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight">Técnicas</h1>
            <p className="text-sm text-muted-foreground">
              Vídeos educativos por skill com a Coach Thaix
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {skills.map((skill) => {
              const progress = skill.total_videos > 0
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
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {progress === 0
                        ? 'Não iniciado'
                        : progress === 100
                        ? '✓ Concluído'
                        : `${skill.watched_videos} de ${skill.total_videos}`}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Cursos existentes */}
        {courses.length > 0 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold">Cursos</h2>
              <p className="text-sm text-muted-foreground">
                Aulas completas com a Coach Aurora
              </p>
            </div>

            <div className="space-y-3">
              {courses.map((course) => {
                const progress = course.total_lessons > 0
                  ? Math.round((course.completed_lessons / course.total_lessons) * 100)
                  : 0
                const isCompleted = course.completed_lessons === course.total_lessons && course.total_lessons > 0

                return (
                  <button
                    key={course.id}
                    onClick={() => router.push(`/cursos/${course.id}`)}
                    className="w-full bg-white rounded-2xl p-5 text-left shadow-sm hover:shadow-md transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        {course.eyebrow && (
                          <p className="text-xs font-bold text-primary uppercase tracking-widest">
                            {course.eyebrow}
                          </p>
                        )}
                        <h3 className="font-extrabold leading-tight">{course.title}</h3>
                        {course.description && (
                          <p className="text-sm text-muted-foreground">{course.description}</p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{course.total_lessons} aulas</span>
                        </div>
                        <span>{isCompleted ? '✓ Concluído' : `${course.completed_lessons} de ${course.total_lessons}`}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
