'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronLeft } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (error) {
      setError(error.message === 'User already registered'
        ? 'Este e-mail já está cadastrado.'
        : 'Erro ao criar conta. Tente novamente.'
      )
      setLoading(false)
      return
    }

    // ✅ Vai para o início do onboarding, não para protocolo
    router.push('/onboarding/apresentacao')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-sm mx-auto w-full px-5">
      <div className="pt-5 pb-2">
        <button onClick={() => router.back()} className="text-foreground/60 hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 flex flex-col justify-center py-8">
        <div className="mb-8">
          <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase mb-2">CRIAR CONTA</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Bora começar.</h1>
          <p className="text-muted-foreground text-sm mt-1">7 dias grátis, sem cartão de crédito.</p>
        </div>
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-semibold">Nome</Label>
            <Input id="name" type="text" placeholder="Seu nome" value={name}
              onChange={(e) => setName(e.target.value)} required autoComplete="name"
              className="h-12 rounded-2xl bg-white border-border" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-semibold">E-mail</Label>
            <Input id="email" type="email" placeholder="seu@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
              className="h-12 rounded-2xl bg-white border-border" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-semibold">Senha</Label>
            <Input id="password" type="password" placeholder="Mínimo 6 caracteres" value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={6}
              autoComplete="new-password" className="h-12 rounded-2xl bg-white border-border" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full h-14 bg-primary text-white font-bold text-base rounded-full hover:bg-primary/90 transition-colors disabled:opacity-40 mt-2">
            {loading ? 'Criando conta...' : 'Criar conta grátis'}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Já tem conta?{' '}
          <Link href="/login" className="text-primary font-semibold hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
