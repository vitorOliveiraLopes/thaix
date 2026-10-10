import { NextRequest, NextResponse } from 'next/server'
import {
  EMERGENCY_REPLY,
  OFF_TOPIC_REPLY,
  actionHistoryLine,
  buildChatTimeline,
  detectHealthConcern,
  detectOffTopic,
  isCoachTool,
  isDisplayTool,
  isWriteTool,
  parseAttachments,
  proposalReply,
  skillName,
  type ChatAttachment,
  type TimelineAction,
} from '@thaix/core'

import { getRouteClient } from '@/lib/supabase/route-client'
import { callClaude, describeCoachError, type ContentBlock, type Message } from '@/lib/coach/anthropic'
import { describeSnapshot, loadSnapshot, saoPauloToday, type CoachCtx } from '@/lib/coach/context'
import { COACH_SYSTEM_PROMPT, INJURY_HINT } from '@/lib/coach/prompt'
import { buildDisplay, buildProposal, runReadTool } from '@/lib/coach/tools'

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

async function saveAssistant(ctx: CoachCtx, content: string, attachments: ChatAttachment[] = []) {
  const row = { user_id: ctx.userId, role: 'assistant', content }
  if (attachments.length === 0) {
    await ctx.client.from('chat_messages').insert(row)
    return
  }
  const { error } = await ctx.client.from('chat_messages').insert({ ...row, attachments })
  // Sem a coluna (SQL ainda não rodado), a mensagem não pode se perder.
  if (error) {
    console.error('[coach] attachments not saved', error.message)
    await ctx.client.from('chat_messages').insert(row)
  }
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

    // 2b. Fora do escopo óbvio (comida, clima, notícias…): resposta fixa, sem IA.
    const offTopic = concern ? null : detectOffTopic(message)
    if (offTopic) {
      const reply = OFF_TOPIC_REPLY[offTopic]
      await saveAssistant(ctx, reply)
      console.info('[coach] off_topic', { user: user.id, kind: offTopic })
      return NextResponse.json({ message: reply, pendingActions: [] })
    }

    // 3. Histórico + contexto do aluno
    const [{ data: rows }, snapshot] = await Promise.all([
      client
        .from('chat_messages')
        // '*': funciona antes e depois da coluna attachments existir.
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(HISTORY_SIZE),
      loadSnapshot(ctx),
    ])
    const history = ((rows ?? []) as { id: string; role: 'user' | 'assistant'; content: string; created_at: string; attachments?: unknown }[]).map(
      m => {
        // O modelo não vê o card, só um registro de que ele foi mostrado.
        const cards = parseAttachments(m.attachments).map(a => `[Card exibido: treino de ${skillName(a.skill_id)} com ${a.items.length} exercícios]`)
        return cards.length ? { ...m, content: `${m.content}\n${cards.join('\n')}` } : m
      },
    )
    // Propostas do mesmo período, com a decisão do aluno: o coach precisa
    // saber o que foi confirmado ou cancelado.
    const oldest = history.length ? history[history.length - 1].created_at : new Date().toISOString()
    const { data: actionRows } = await client
      .from('chat_pending_actions')
      .select('id, status, summary, result_note, created_at')
      .eq('user_id', user.id)
      .gte('created_at', oldest)
      .order('created_at', { ascending: true })
      .limit(HISTORY_SIZE)

    // A API exige começar pelo usuário e alternar papéis: entradas seguidas
    // do mesmo papel (ex.: resposta + decisão de uma proposta) viram uma só.
    const messages: Message[] = []
    for (const entry of buildChatTimeline(history, (actionRows ?? []) as TimelineAction[])) {
      const role = entry.kind === 'msg' ? entry.msg.role : 'assistant'
      const content = entry.kind === 'msg' ? entry.msg.content : actionHistoryLine(entry.action)
      const last = messages[messages.length - 1]
      if (last && last.role === role && typeof last.content === 'string') last.content += `\n\n${content}`
      else messages.push({ role, content })
    }
    while (messages.length && messages[0].role !== 'user') messages.shift()

    const dynamic = describeSnapshot(snapshot, ctx) + (concern === 'injury' ? `\n\n${INJURY_HINT}` : '')

    // 4. Loop de ferramentas: leitura executa aqui; escrita vira proposta
    const texts: string[] = []
    const pending: PendingOut[] = []
    const attachments: ChatAttachment[] = []

    const started = Date.now()
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const remaining = DEADLINE_MS - (Date.now() - started)
      if (remaining < 8_000) break
      // Última rodada (ou pouco tempo sobrando): sem ferramentas, só a resposta.
      const lastRound = round === MAX_TOOL_ROUNDS - 1 || remaining < 20_000
      const roundStart = Date.now()
      const response = await callClaude(COACH_SYSTEM_PROMPT, dynamic, messages, {
        allowTools: !lastRound,
        timeoutMs: Math.min(25_000, remaining - 3_000),
      })
      console.info('[coach] round', { user: user.id, round, ms: Date.now() - roundStart, stop: response.stop_reason, ...response.usage })

      const text = response.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n').trim()
      if (text) texts.push(text)

      const toolUses = response.content.filter(b => b.type === 'tool_use') as Extract<ContentBlock, { type: 'tool_use' }>[]
      if (response.stop_reason !== 'tool_use' || toolUses.length === 0) break

      messages.push({ role: 'assistant', content: response.content })
      const results: ContentBlock[] = []
      let needsFollowUp = false

      for (const call of toolUses) {
        if (!isCoachTool(call.name)) {
          results.push({ type: 'tool_result', tool_use_id: call.id, content: 'Ferramenta inexistente.', is_error: true })
          needsFollowUp = true
          continue
        }

        if (isDisplayTool(call.name)) {
          const shown = await buildDisplay(call.name, call.input ?? {}, ctx).catch(e => ({ error: e instanceof Error ? e.message : 'erro' }))
          if ('error' in shown) {
            results.push({ type: 'tool_result', tool_use_id: call.id, content: shown.error, is_error: true })
            needsFollowUp = true
          } else {
            // Mesmo card duas vezes na mesma resposta não ajuda.
            for (const a of shown) if (!attachments.some(x => x.workout_id === a.workout_id)) attachments.push(a)
            results.push({ type: 'tool_result', tool_use_id: call.id, content: 'Card com os exercícios exibido ao aluno abaixo da sua mensagem. Não liste os exercícios no texto.' })
          }
          continue
        }

        if (!isWriteTool(call.name)) {
          const data = await runReadTool(call.name, call.input ?? {}, ctx).catch(e => ({ error: e instanceof Error ? e.message : 'erro' }))
          results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(data).slice(0, MAX_TOOL_RESULT_CHARS) })
          needsFollowUp = true
          continue
        }

        const proposal = await buildProposal(call.name, call.input ?? {}, ctx).catch(e => ({ error: e instanceof Error ? e.message : 'erro' }))
        if ('error' in proposal) {
          results.push({ type: 'tool_result', tool_use_id: call.id, content: proposal.error, is_error: true })
          needsFollowUp = true
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
          needsFollowUp = true
          continue
        }

        pending.push({ id: inserted.id, toolName: call.name, summary: proposal.summary, preview: proposal.preview })
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: `Proposta exibida ao aluno com os botões Confirmar e Cancelar: "${proposal.summary}". Nada foi gravado ainda.`,
        })
      }

      // Só propostas e todas criadas: a prévia já está na tela. Mais uma
      // chamada ao modelo só atrasaria a resposta (era o gargalo do "só tenho 20 min").
      if (!needsFollowUp) break

      messages.push({ role: 'user', content: results })
    }

    const reply =
      texts.join('\n\n') ||
      (pending.length ? proposalReply(pending.map(p => p.summary)) : attachments.length ? 'Aqui está o seu treino de hoje 👇' : proposalReply([]))
    console.info('[coach] done', { user: user.id, ms: Date.now() - started, proposals: pending.length, cards: attachments.length })
    await saveAssistant(ctx, reply, attachments)

    return NextResponse.json({ message: reply, pendingActions: pending, attachments })
  } catch (err) {
    const info = describeCoachError(err)
    // Log com o motivo dado pela Anthropic (nunca a chave).
    console.error('[POST /api/chat]', info.code, err instanceof Error ? err.message : err)
    return NextResponse.json({ error: info.message, code: info.code }, { status: info.status })
  }
}
