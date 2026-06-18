'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Profile, UserSettings } from '@/types/database'
import {
  User, Bell, ChevronRight, LogOut,
  Crown, Settings, HelpCircle, Dumbbell
} from 'lucide-react'

export default function PerfilPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [profileRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
      ])

      setProfile(profileRes.data)
      setSettings(settingsRes.data)
      setLoading(false)
    }
    load()
  }, [router])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  function getStatusLabel(status: string | undefined) {
    switch (status) {
      case 'trial':    return { label: 'Trial gratuito', variant: 'secondary' as const }
      case 'active':   return { label: 'Ativo', variant: 'default' as const }
      case 'cancelled':return { label: 'Cancelado', variant: 'destructive' as const }
      default:         return { label: 'Sem plano', variant: 'outline' as const }
    }
  }

  function getTrialDaysLeft(trialEndsAt: string | null, now: number): number | null {
    if (!trialEndsAt) return null
    const diff = new Date(trialEndsAt).getTime() - now
    return Math.max(0, Math.ceil(diff / 86400000))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const statusInfo = getStatusLabel(settings?.subscription_status)
  const daysLeft = getTrialDaysLeft(settings?.trial_ends_at ?? null, now)

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto px-4 pt-10 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">
              {profile?.name ?? 'Atleta'}
            </h1>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
          </div>
        </div>

        {/* Assinatura */}
        <div className="bg-white rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              <span className="font-medium text-sm">Minha assinatura</span>
            </div>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>

          {settings?.subscription_status === 'trial' && daysLeft !== null && (
            <p className="text-sm text-muted-foreground">
              {daysLeft > 0
                ? `${daysLeft} ${daysLeft === 1 ? 'dia restante' : 'dias restantes'} no trial`
                : 'Trial encerrado'}
            </p>
          )}

          {settings?.subscription_status === 'active' && (
            <p className="text-sm text-muted-foreground">
              Plano {settings.subscription_plan}
            </p>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/perfil/assinatura')}
          >
            {settings?.subscription_status === 'trial'
              ? 'Ver planos e assinar'
              : 'Gerenciar assinatura'}
          </Button>
        </div>

        {/* Menu */}
        <div className="bg-white rounded-2xl divide-y divide-border shadow-sm overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors"
            onClick={() => router.push('/perfil/notificacoes')}
          >
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Notificações</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <button
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors"
            onClick={() => router.push('/perfil/protocolo')}
          >
            <div className="flex items-center gap-3">
              <Dumbbell className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Trocar treinos</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          
          <button
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors"
            onClick={() => router.push('/perfil/preferencias')}
          >
            <div className="flex items-center gap-3">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Preferências</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <button
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors"
            onClick={() => router.push('/perfil/suporte')}
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Suporte</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-destructive hover:opacity-80 transition-opacity"
        >
          <LogOut className="w-4 h-4" />
          Sair da conta
        </button>

      </div>
    </div>
  )
}