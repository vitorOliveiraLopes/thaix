import { NextRequest, NextResponse } from 'next/server'
import { getRouteClient } from '@/lib/supabase/route-client'
import { executeAction } from '@/lib/chat-actions'
import type { ChatToolName } from '@/lib/chat-tools'


// ─── POST /api/chat/confirm ───────────────────────────────────────────────────
//
// Único ponto do sistema que efetivamente grava uma ação proposta pelo chat.
// Sempre exige que o aluno tenha clicado em "Confirmar" na tela.

export async function POST(req: NextRequest) {
  try {
    const { client: authClient, user } = await getRouteClient(req)

    if (!authClient || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const actionId: string | undefined = body?.actionId
    const confirmed: boolean = body?.confirmed === true

    if (!actionId) {
      return NextResponse.json({ error: 'actionId é obrigatório' }, { status: 400 })
    }

    // Ownership via RLS — só retorna se pertencer ao usuário logado
    const { data: action, error: fetchError } = await authClient
      .from('chat_pending_actions')
      .select('id, tool_name, params, status')
      .eq('id', actionId)
      .single()

    if (fetchError || !action) {
      return NextResponse.json({ error: 'Ação não encontrada' }, { status: 404 })
    }

    if (action.status !== 'pending') {
      return NextResponse.json({ error: 'Esta ação já foi resolvida' }, { status: 409 })
    }

    if (!confirmed) {
      await authClient
        .from('chat_pending_actions')
        .update({ status: 'declined', resolved_at: new Date().toISOString() })
        .eq('id', actionId)

      return NextResponse.json({ success: true, message: 'Ação cancelada.' })
    }

    // Executa de fato — único lugar do sistema que grava dados vindos do chat
    const result = await executeAction(
      authClient, user.id, action.tool_name as ChatToolName, action.params
    )

    await authClient
      .from('chat_pending_actions')
      .update({
        status:      result.success ? 'confirmed' : 'failed',
        result_note: result.message,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', actionId)

    // Registra o resultado no histórico da conversa também
    await authClient.from('chat_messages').insert({
      user_id: user.id, role: 'assistant', content: result.message,
    })

    return NextResponse.json({ success: result.success, message: result.message })

  } catch (err) {
    console.error('[POST /api/chat/confirm]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
