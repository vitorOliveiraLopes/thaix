'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type NotificationSettings = {
  workout: { time: string; enabled: boolean }
  hydration: { time: string; enabled: boolean }
}

export default function NotificacoesPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<NotificationSettings>({
    workout: { time: '07:30', enabled: true },
    hydration: { time: '14:00', enabled: true },
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('user_settings')
        .select('notifications')
        .eq('user_id', user.id)
        .single()

      if (data?.notifications) {
        setSettings(data.notifications as NotificationSettings)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('user_settings')
      .update({ notifications: settings })
      .eq('user_id', user.id)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function updateToggle(key: 'workout' | 'hydration', value: boolean) {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], enabled: value },
    }))
  }

  function updateTime(key: 'workout' | 'hydration', value: string) {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], time: value },
    }))
  }

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

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-muted rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">Notificações</h1>
        </div>

        <div className="border rounded-2xl divide-y divide-border overflow-hidden">

          {/* Treino */}
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Lembrete de treino</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aviso diário para não perder o treino
                </p>
              </div>
              <button
                onClick={() => updateToggle('workout', !settings.workout.enabled)}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative',
                  settings.workout.enabled ? 'bg-foreground' : 'bg-muted'
                )}
              >
                <div className={cn(
                  'w-5 h-5 rounded-full bg-background absolute top-0.5 transition-all',
                  settings.workout.enabled ? 'left-5' : 'left-0.5'
                )} />
              </button>
            </div>
            {settings.workout.enabled && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Horário</span>
                <input
                  type="time"
                  value={settings.workout.time}
                  onChange={e => updateTime('workout', e.target.value)}
                  className="text-sm font-medium bg-muted px-3 py-1.5 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-foreground"
                />
              </div>
            )}
          </div>

          {/* Hidratação */}
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Lembrete de hidratação</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Lembra de beber água e marcar a meta
                </p>
              </div>
              <button
                onClick={() => updateToggle('hydration', !settings.hydration.enabled)}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative',
                  settings.hydration.enabled ? 'bg-foreground' : 'bg-muted'
                )}
              >
                <div className={cn(
                  'w-5 h-5 rounded-full bg-background absolute top-0.5 transition-all',
                  settings.hydration.enabled ? 'left-5' : 'left-0.5'
                )} />
              </button>
            </div>
            {settings.hydration.enabled && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Horário</span>
                <input
                  type="time"
                  value={settings.hydration.time}
                  onChange={e => updateTime('hydration', e.target.value)}
                  className="text-sm font-medium bg-muted px-3 py-1.5 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-foreground"
                />
              </div>
            )}
          </div>

        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'w-full h-11 rounded-xl text-sm font-medium transition-all',
            saved
              ? 'bg-muted text-muted-foreground'
              : 'bg-foreground text-background hover:opacity-90'
          )}
        >
          {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar preferências'}
        </button>

        <p className="text-xs text-muted-foreground text-center">
          O envio de notificações será ativado em breve.
        </p>

      </div>
    </div>
  )
}