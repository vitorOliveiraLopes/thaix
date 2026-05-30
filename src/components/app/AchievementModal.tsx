'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Achievement } from '@/types/database'

type Props = {
  achievementIds: string[]
  onClose: () => void
}

export function AchievementModal({ achievementIds, onClose }: Props) {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('achievements')
        .select('*')
        .in('id', achievementIds)

      setAchievements(data ?? [])
      setLoading(false)
    }
    load()
  }, [achievementIds])

  function handleNext() {
    if (currentIndex < achievements.length - 1) {
      setCurrentIndex(i => i + 1)
    } else {
      onClose()
    }
  }

  if (loading || achievements.length === 0) return null

  const current = achievements[currentIndex]
  const isLast = currentIndex === achievements.length - 1
  const isSessionCount = current.type === 'session_count'

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-[200] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 text-center">

        {/* Badge de conquista */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            +1 Skill Unlocked
          </p>
          <div className={cn(
            'w-24 h-24 rounded-3xl mx-auto flex items-center justify-center text-5xl',
            'bg-foreground'
          )}>
            {isSessionCount ? '🏆' : '💪'}
          </div>
        </div>

        {/* Info da conquista */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {current.name}
          </h2>
          {current.description && (
            <p className="text-sm text-muted-foreground">
              {current.description}
            </p>
          )}
          {current.threshold && (
            <p className="text-sm font-medium">
              🎯 {current.threshold} treinos concluídos
            </p>
          )}
        </div>

        {/* Indicador de múltiplas conquistas */}
        {achievements.length > 1 && (
          <div className="flex justify-center gap-1.5">
            {achievements.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  i === currentIndex ? 'bg-foreground' : 'bg-muted'
                )}
              />
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Button
            className="w-full h-12 text-base"
            onClick={handleNext}
          >
            {isLast ? 'Continuar 🚀' : `Próxima (${currentIndex + 1}/${achievements.length})`}
          </Button>
        </div>

      </div>
    </div>
  )
}