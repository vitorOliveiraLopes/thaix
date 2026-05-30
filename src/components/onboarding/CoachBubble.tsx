import { cn } from '@/lib/utils'

interface CoachBubbleProps {
  title: string
  subtitle?: string
  className?: string
}

export function CoachBubble({ title, subtitle, className }: CoachBubbleProps) {
  return (
    <div className={cn("flex items-start gap-3 mb-6", className)}>
      {/* Avatar genérico da coach */}
      <div className="shrink-0 w-11 h-11 rounded-full bg-primary flex items-center justify-center text-white font-bold text-base">
        T
      </div>
      <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 flex-1 shadow-sm">
        <p className="font-semibold text-sm leading-snug text-foreground">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
