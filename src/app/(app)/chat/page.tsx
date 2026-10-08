'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Droplet, Trophy, Scale, HelpCircle, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type PendingAction = {
  id: string
  toolName: string
  summary: string
  status: 'pending' | 'confirmed' | 'declined'
}

// ─── Constants ───────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: Droplet,     label: 'Registrar hidratação',   prompt: 'Quero registrar minha hidratação de hoje' },
  { icon: Scale,       label: 'Atualizar peso',          prompt: 'Quero atualizar meu peso' },
  { icon: Trophy,      label: 'Registrar PR',            prompt: 'Quero registrar um recorde pessoal' },
  { icon: HelpCircle,  label: 'Tirar uma dúvida',        prompt: 'Tenho uma dúvida sobre meu treino' },
]

// ─── PendingActionCard ─────────────────────────────────────────────────────────

function PendingActionCard({
  action,
  onResolve,
}: {
  action: PendingAction
  onResolve: (id: string, confirmed: boolean) => void
}) {
  const [resolving, setResolving] = useState(false)

  async function handle(confirmed: boolean) {
    setResolving(true)
    await onResolve(action.id, confirmed)
  }

  if (action.status !== 'pending') return null

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 max-w-[85%] space-y-3">
      <p className="text-sm font-medium">{action.summary}</p>
      <div className="flex gap-2">
        <button
          onClick={() => handle(true)}
          disabled={resolving}
          className="flex-1 h-9 bg-primary text-white text-sm font-bold rounded-full flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" /> Confirmar
        </button>
        <button
          onClick={() => handle(false)}
          disabled={resolving}
          className="h-9 px-4 border border-border text-sm font-medium rounded-full flex items-center justify-center gap-1.5 text-muted-foreground disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadHistory() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('chat_messages')
        .select('id, role, content')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50)

      if (data) setMessages(data as ChatMessage[])
      setLoadingHistory(false)
    }
    loadHistory()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingActions])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    const userMessage: ChatMessage = { id: `local-${Date.now()}`, role: 'user', content: text }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`, role: 'assistant',
          content: 'Ops, tive um problema para responder. Tenta de novo?',
        }])
        return
      }

      if (data.message) {
        setMessages(prev => [...prev, {
          id: `assistant-${Date.now()}`, role: 'assistant', content: data.message,
        }])
      }

      if (data.pendingActions?.length > 0) {
        setPendingActions(prev => [
          ...prev,
          ...data.pendingActions.map((a: any) => ({ ...a, status: 'pending' })),
        ])
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`, role: 'assistant',
        content: 'Não consegui me conectar agora. Verifica sua internet e tenta de novo.',
      }])
    } finally {
      setLoading(false)
    }
  }

  async function resolveAction(actionId: string, confirmed: boolean) {
    try {
      const res = await fetch('/api/chat/confirm', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ actionId, confirmed }),
      })
      const data = await res.json()

      setPendingActions(prev =>
        prev.map(a => a.id === actionId ? { ...a, status: confirmed ? 'confirmed' : 'declined' } : a)
      )

      if (data.message) {
        setMessages(prev => [...prev, {
          id: `result-${Date.now()}`, role: 'assistant', content: data.message,
        }])
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`, role: 'assistant',
        content: 'Não consegui processar essa ação. Tenta de novo?',
      }])
    }
  }

  const showQuickActions = !loadingHistory && messages.length === 0

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-sm mx-auto">

      {/* Header */}
      <div className="px-5 pt-10 pb-4">
        <h1 className="text-xl font-extrabold">Assistente</h1>
        <p className="text-xs text-muted-foreground">Tire dúvidas ou registre dados do seu treino</p>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
        {loadingHistory && (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {showQuickActions && (
          <div className="space-y-2 pt-4">
            <p className="text-xs text-muted-foreground text-center pb-2">
              Como posso ajudar hoje?
            </p>
            {QUICK_ACTIONS.map(({ icon: Icon, label, prompt }) => (
              <button
                key={label}
                onClick={() => sendMessage(prompt)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all text-left"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        )}

        {messages.map(m => (
          <div
            key={m.id}
            className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                m.role === 'user'
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-white shadow-sm rounded-bl-sm'
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {pendingActions.filter(a => a.status === 'pending').map(action => (
          <div key={action.id} className="flex justify-start">
            <PendingActionCard action={action} onResolve={resolveAction} />
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-4 border-t border-border bg-background">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Digite sua mensagem..."
            className="flex-1 h-11 px-4 rounded-full border border-border bg-white text-sm focus:outline-none focus:border-primary"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  )
}
