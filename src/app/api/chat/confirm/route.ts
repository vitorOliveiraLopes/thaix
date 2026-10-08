import { NextRequest, NextResponse } from 'next/server'

import { getRouteClient } from '@/lib/supabase/route-client'
import { saoPauloToday, type CoachCtx } from '@/lib/coach/context'
import { executeProposal } from '@/lib/coach/tools'

/** Propostas mais velhas que isso precisam ser refeitas (o treino pode ter mudado). */
const PROPOSAL_TTL_MS = 30 * 60_000

// ─── POST /api/chat/confirm ───────────────────────────────────────────────────
//
// Único ponto que grava uma ação proposta pelo coach, e só depois que o
// aluno toca em Confirmar. Tudo roda com o token do aluno (RLS).

export async function POST(req: NextRequest) {
  try {
    const { client, user } = await getRouteClient(req)
    if (!client || !user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const actionId: string | undefined = body?.actionId
    const confirmed = body?.confirmed === true
    if (!actionId) return NextResponse.json({ error: 'actionId é obrigatório' }, { status: 400 })

    const { data: action } = await client
      .from('chat_pending_actions')
      .select('id, tool_name, params, status, created_at')
      .eq('id', actionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!action) return NextResponse.json({ error: 'Ação não encontrada' }, { status: 404 })
    if (action.status !== 'pending') return NextResponse.json({ error: 'Esta ação já foi resolvida' }, { status: 409 })

    // Marca como resolvida ANTES de executar: dois toques rápidos não gravam duas vezes.
    const { data: claimed } = await client
      .from('chat_pending_actions')
      .update({ status: confirmed ? 'confirmed' : 'declined', resolved_at: new Date().toISOString() })
      .eq('id', actionId)
      .eq('status', 'pending')
      .select('id')
    if (!claimed?.length) return NextResponse.json({ error: 'Esta ação já foi resolvida' }, { status: 409 })

    if (!confirmed) return NextResponse.json({ success: true, message: 'Ok, deixei como estava.', refresh: [] })

    const params = (action.params ?? {}) as { payload?: unknown; today?: string; dow?: number }
    const expired = Date.now() - new Date(action.created_at).getTime() > PROPOSAL_TTL_MS
    const date = params.today && Number.isInteger(params.dow) ? { today: params.today, dow: params.dow! } : saoPauloToday()

    const result = expired
      ? { success: false, message: 'Essa proposta expirou. Peça de novo e eu recalculo.', refresh: [] as string[] }
      : await executeProposal(action.tool_name, params.payload ?? {}, { client, userId: user.id, ...date } satisfies CoachCtx)

    await client
      .from('chat_pending_actions')
      .update({ status: result.success ? 'confirmed' : 'failed', result_note: result.message })
      .eq('id', actionId)
    await client.from('chat_messages').insert({ user_id: user.id, role: 'assistant', content: result.message })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[POST /api/chat/confirm]', err)
    return NextResponse.json({ error: 'Não consegui processar essa ação agora.' }, { status: 500 })
  }
}
