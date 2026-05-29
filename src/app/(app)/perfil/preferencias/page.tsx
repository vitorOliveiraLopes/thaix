'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type Preferences = {
  theme: 'light' | 'dark' | 'system'
  weightUnit: 'kg' | 'lb'
}

export default function PreferenciasPage() {
  const router = useRouter()
  const [prefs, setPrefs] = useState<Preferences>({
    theme: 'system',
    weightUnit: 'kg',
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
        .select('preferences')
        .eq('user_id', user.id)
        .single()

      if (data?.preferences) {
        setPrefs(data.preferences as Preferences)
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
      .update({ preferences: prefs })
      .eq('user_id', user.id)

    // Aplica tema imediatamente
    const root = document.documentElement
    if (prefs.theme === 'dark') root.classList.add('dark')
    else if (prefs.theme === 'light') root.classList.remove('dark')
    else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      prefersDark ? root.classList.add('dark') : root.classList.remove('dark')
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
          <h1 className="text-xl font-semibold">Preferências</h1>
        </div>

        <div className="border rounded-2xl divide-y divide-border overflow-hidden">

          {/* Tema */}
          <div className="p-5 space-y-3">
            <p className="font-medium text-sm">Tema</p>
            <div className="grid grid-cols-3 gap-2">
              {(['light', 'dark', 'system'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setPrefs(p => ({ ...p, theme: t }))}
                  className={cn(
                    'py-2.5 rounded-xl text-sm font-medium border transition-all',
                    prefs.theme === t
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border hover:border-foreground/40'
                  )}
                >
                  {t === 'light' ? '☀️ Claro' : t === 'dark' ? '🌙 Escuro' : '⚙️ Sistema'}
                </button>
              ))}
            </div>
          </div>

          {/* Unidade de peso */}
          <div className="p-5 space-y-3">
            <p className="font-medium text-sm">Unidade de peso</p>
            <div className="grid grid-cols-2 gap-2">
              {(['kg', 'lb'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => setPrefs(p => ({ ...p, weightUnit: u }))}
                  className={cn(
                    'py-2.5 rounded-xl text-sm font-medium border transition-all',
                    prefs.weightUnit === u
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border hover:border-foreground/40'
                  )}
                >
                  {u === 'kg' ? 'Quilogramas (kg)' : 'Libras (lb)'}
                </button>
              ))}
            </div>
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

      </div>
    </div>
  )
}