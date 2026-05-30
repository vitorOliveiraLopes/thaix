'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

// 8 steps — horario e notificacoes removidos (incorporados em frequencia)
const STEPS = [
  '/onboarding/apresentacao',
  '/onboarding/motivacao',
  '/onboarding/como-conheceu',
  '/onboarding/skills',
  '/onboarding/trava',
  '/onboarding/teste-fisico',
  '/onboarding/frequencia',
  '/onboarding/peso',
  '/onboarding/protocolo',
]

interface OnboardingHeaderProps {
  backHref?: string
}

export function OnboardingHeader({ backHref }: OnboardingHeaderProps) {
  const pathname = usePathname()
  const currentIndex = STEPS.indexOf(pathname)

  return (
    <div className="flex items-center gap-3 px-5 pt-5 pb-2">
      {backHref ? (
        <Link href={backHref} className="shrink-0 text-foreground/60 hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
      ) : (
        <div className="w-5" />
      )}
      <div className="flex-1 flex gap-[3px]">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-[3px] flex-1 rounded-full transition-all duration-300",
              i <= currentIndex ? "bg-primary" : "bg-border"
            )}
          />
        ))}
      </div>
    </div>
  )
}
