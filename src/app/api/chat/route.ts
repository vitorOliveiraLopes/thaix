import { NextRequest, NextResponse } from 'next/server'
import { EMERGENCY_REPLY, detectHealthConcern, isCoachTool, isWriteTool } from '@thaix/core'

import { getRouteClient } from '@/lib/supabase/route-client'
import { callClaude, type ContentBlock, type Message } from '@/lib/coach/anthropic'
import { describeSnapshot, loadSnapshot, saoPauloToday, type CoachCtx } from '@/lib/coach/context'
import { COACH_SYSTEM_PROMPT, INJURY_HINT } from '@/lib/coach/prompt'
import { buildProposal, runReadTool } from '@/lib/coach/tools'

// ─── Configuração ─────────────────────────────────────────────────────────────

/** Limite da função na Vercel (o loop de ferramentas pode levar várias chamadas). */
export const maxDuration = 60

/** Mensagens do aluno por dia. Controla custo; ajustável sem deploy de código. */
const DAILY_LIMIT = Number(process.env.COACH_DAILY_LIMIT ?? 40)
/** Rodadas de ferramenta por mensagem (consulta → resposta). */
const MAX_TOOL_ROUNDS = 5
const HISTORY_SIZE = 20
const MAX_TOOL_RESULT_CHARS = 6000

type PendingOut = { id: string; toolName: string; summary: string; preview: string[] }

/** Tempo total para responder: abaixo do limite da Vercel e do app. */
const DEADLINE_MS = 50_000

/**
 * "Hoje" vem do aparelho (o servidor roda em UTC), mas só é aceito se
 * estiver a no máximo 1 dia da data do servidor.
 */
function resolveDate(body: any): { today: string; dow: number } {
  const server = saoPauloToday()
  const valid =
    typeof body?.today === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.today) &&
    Number.isInteger(body?.dow) &&
    body.dow >= 0 &&
    body.dow <= 6 &&
    Math.abs(Date.parse(body.today) - Date.parse(server.today)) <= 86_400_000
  return valid ? { today: body.today, dow: body.dow } : server
}

async function saveAssistant(ctx: CoachCtx, content: string) {
  await ctx.client.from('chat_messages').insert({ user_id: ctx.userId, role: 'assistant', content })
}

// ─── POST /api/chat ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { client, user } = await getRouteClient(req)
    if (!client || !user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 1000) : ''
    if (!message) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

    const ctx: CoachCtx = { client, userId: user.id, ...resolveDate(body) }

    // 1. Cota: mensagens do aluno nas últimas 24h, contadas pelo relógio do servidor
    const since = new Date(Date.now() - 86_400_000).toISOString()
    const { count, error: countError } = await client
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'user')
      .gte('created_at', since)
    if (countError) console.error('[coach] quota check failed', countError.message)
    if ((count ?? 0) >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: `Você chegou ao limite de ${DAILY_LIMIT} mensagens por dia. Daqui a pouco a gente continua! 💪` },
        { status: 429 },
      )
    }

    await client.from('chat_messages').insert({ user_id: user.id, role: 'user', content: message })

    // 2. Filtro de saúde: urgência tem resposta fixa, sem passar pela IA
    const concern = detectHealthConcern(message)
    if (concern === 'emergency') {
      await saveAssistant(ctx, EMERGENCY_REPLY)
      return NextResponse.json({ message: EMERGENCY_REPLY, pendingActions: [] })
    }

    // 3. Histórico + contexto do aluno
    const [{ data: rows }, snapshot] = await Promise.all([
      client.from('chat_messages').select('role, content').eq('user_id', user.id).order('created_at', { ascending: false }).limit(HISTORY_SIZE),
      loadSnapshot(ctx),
    ])
    // A API exige começar pelo usuário e alternar papéis: mensagens seguidas
    // do mesmo papel (ex.: resposta + resultado de uma confirmação) viram uma só.
    const messages: Message[] = []
    for (const m of ((rows ?? []) as { role: 'user' | 'assistant'; content: string }[]).reverse()) {
      const last = messages[messages.length - 1]
      if (last && last.role === m.role && typeof last.content === 'string') last.content += `\n\n${m.content}`
      else messages.push({ role: m.role, content: m.content })
    }
    while (messages.length && messages[0].role !== 'user') messages.shift()

    const dynamic = describeSnapshot(snapshot, ctx) + (concern === 'injury' ? `\n\n${INJURY_HINT}` : '')

    // 4. Loop de ferramentas: leitura executa aqui; escrita vira proposta
    const texts: string[] = []
    const pending: PendingOut[] = []

    const started = Date.now()
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const remaining = DEADLINE_MS - (Date.now() - started)
      if (remaining < 8_000) break
      // Última rodada (ou pouco tempo sobrando): sem ferramentas, só a resposta.
      const lastRound = round === MAX_TOOL_ROUNDS - 1 || remaining < 20_000
      const response = await callClaude(COACH_SYSTEM_PROMPT, dynamic, messages, {
        allowTools: !lastRound,
        timeoutMs: Math.min(25_000, remaining - 3_000),
      })
      if (response.usage) {
        console.info('[coach] usage', { user: user.id, round, ...response.usage })
      }

      const text = response.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n').trim()
      if (text) texts.push(text)

      const toolUses = response.content.filter(b => b.type === 'tool_use') as Extract<ContentBlock, { type: 'tool_use' }>[]
      if (response.stop_reason !== 'tool_use' || toolUses.length === 0) break

      messages.push({ role: 'assistant', content: response.content })
      const results: ContentBlock[] = []

      for (const call of toolUses) {
        if (!isCoachTool(call.name)) {
          results.push({ type: 'tool_result', tool_use_id: call.id, content: 'Ferramenta inexistente.', is_error: true })
          continue
        }

        if (!isWriteTool(call.name)) {
          const data = await runReadTool(call.name, call.input ?? {}, ctx).catch(e => ({ error: e instanceof Error ? e.message : 'erro' }))
          results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(data).slice(0, MAX_TOOL_RESULT_CHARS) })
          continue
        }

        const proposal = await buildProposal(call.name, call.input ?? {}, ctx).catch(e => ({ error: e instanceof Error ? e.message : 'erro' }))
        if ('error' in proposal) {
          results.push({ type: 'tool_result', tool_use_id: call.id, content: proposal.error, is_error: true })
          continue
        }

        const { data: inserted, error } = await client
          .from('chat_pending_actions')
          .insert({
            user_id: user.id,
            tool_name: call.name,
            params: { payload: proposal.payload, preview: proposal.preview, today: ctx.today, dow: ctx.dow },
            summary: proposal.summary,
            status: 'pending',
          })
          .select('id')
          .single()

        if (error || !inserted) {
          results.push({ type: 'tool_result', tool_use_id: call.id, content: 'Não consegui criar a proposta.', is_error: true })
          continue
        }

        pending.push({ id: inserted.id, toolName: call.name, summary: proposal.summary, preview: proposal.preview })
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: `Proposta exibida ao aluno com os botões Confirmar e Cancelar: "${proposal.summary}". Nada foi gravado ainda.`,
        })
      }

      messages.push({ role: 'user', content: results })
    }

    const reply = texts.join('\n\n') || (pending.length ? 'Preparei a proposta abaixo. É só confirmar.' : 'Não consegui responder agora. Tenta reformular?')
    await saveAssistant(ctx, reply)

    return NextResponse.json({ message: reply, pendingActions: pending })
  } catch (err) {
    console.error('[POST /api/chat]', err)
    return NextResponse.json({ error: 'O coach está indisponível agora. Tente em instantes.' }, { status: 500 })
  }
}
