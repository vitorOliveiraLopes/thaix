'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Dumbbell, BookOpen, Users, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/home',      label: 'Início',    icon: Home },
  { href: '/treinos',   label: 'Treinos',   icon: Dumbbell },
  { href: '/cursos',    label: 'Cursos',    icon: BookOpen },
  { href: '/comunidade',label: 'Comunidade',icon: Users },
  { href: '/perfil',    label: 'Perfil',    icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="max-w-md mx-auto px-2">
        <div className="flex items-center justify-around h-16">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[56px]',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn(
                  'w-5 h-5 transition-all',
                  isActive && 'scale-110'
                )} />
                <span className={cn(
                  'text-[10px] font-medium leading-none',
                  isActive && 'font-semibold'
                )}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}