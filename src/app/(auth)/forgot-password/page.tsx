'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })

    if (error) {
      setError('Erro ao enviar e-mail. Verifique o endereço e tente novamente.')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-5xl">📬</div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              E-mail enviado
            </h1>
            <p className="text-sm text-muted-foreground">
              Enviamos um link para <strong>{email}</strong>. Verifique sua caixa de entrada e clique no link para redefinir sua senha.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Não recebeu?{' '}
            <button
              onClick={() => setSent(false)}
              className="underline hover:text-foreground transition-colors"
            >
              Tentar novamente
            </button>
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/login')}
          >
            Voltar para o login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">

        <div className="space-y-1">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Recuperar senha
          </h1>
          <p className="text-sm text-muted-foreground">
            Digite seu e-mail e enviaremos um link para redefinir sua senha.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full h-12"
            disabled={loading}
          >
            {loading ? 'Enviando...' : 'Enviar link de recuperação'}
          </Button>
        </form>

      </div>
    </div>
  )
}