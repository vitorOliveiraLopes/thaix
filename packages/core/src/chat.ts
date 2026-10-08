/**
 * ThaixSkill — Linha do tempo do chat do coach
 *
 * Mensagens e propostas (com a decisão do aluno) numa ordem só, usada pelo
 * app para desenhar a conversa e pelo servidor para o histórico do modelo.
 */

/** Propostas mais velhas que isso não podem mais ser confirmadas. */
export const PROPOSAL_TTL_MS = 30 * 60_000

export type ActionDbStatus = 'pending' | 'confirmed' | 'declined' | 'failed'
/** Estado mostrado: "expired" é uma proposta pendente que passou do prazo. */
export type ActionState = ActionDbStatus | 'expired'

export type TimelineMessage = { id: string; role: 'user' | 'assistant'; content: string; created_at: string }
export type TimelineAction = { id: string; status: ActionDbStatus; summary: string; result_note: string | null; created_at: string }

export type TimelineEntry<M extends TimelineMessage, A extends TimelineAction> =
  | { kind: 'msg'; msg: M }
  | { kind: 'action'; action: A; state: ActionState }

export function actionState(action: Pick<TimelineAction, 'status' | 'created_at'>, now = Date.now()): ActionState {
  if (action.status !== 'pending') return action.status
  return now - Date.parse(action.created_at) > PROPOSAL_TTL_MS ? 'expired' : 'pending'
}

/**
 * Junta mensagens e propostas em ordem cronológica. A proposta é criada
 * enquanto o coach ainda está escrevendo, então entra logo DEPOIS da
 * resposta do coach daquele turno (primeira mensagem do coach criada depois
 * dela), como no WhatsApp: texto e, embaixo, o card.
 */
export function buildChatTimeline<M extends TimelineMessage, A extends TimelineAction>(
  messages: M[],
  actions: A[],
  now = Date.now(),
): TimelineEntry<M, A>[] {
  const msgs = [...messages].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  const acts = [...actions].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))

  // Posição de cada proposta: índice da resposta do coach daquele turno.
  const anchorOf = (a: A) => {
    const t = Date.parse(a.created_at)
    const i = msgs.findIndex(m => m.role === 'assistant' && Date.parse(m.created_at) >= t)
    return i === -1 ? msgs.length : i + 1
  }

  const out: TimelineEntry<M, A>[] = []
  let next = 0
  for (let i = 0; i <= msgs.length; i++) {
    while (next < acts.length && anchorOf(acts[next]) === i) {
      out.push({ kind: 'action', action: acts[next], state: actionState(acts[next], now) })
      next++
    }
    if (i < msgs.length) out.push({ kind: 'msg', msg: msgs[i] })
  }
  // Âncoras sempre crescem com o tempo, mas por garantia nada fica de fora.
  for (; next < acts.length; next++) out.push({ kind: 'action', action: acts[next], state: actionState(acts[next], now) })
  return out
}

const STATE_LABEL: Record<ActionState, string> = {
  pending: 'aguardando o aluno',
  confirmed: 'CONFIRMADA pelo aluno e aplicada',
  declined: 'CANCELADA pelo aluno (nada foi alterado)',
  failed: 'confirmada, mas NÃO aplicada',
  expired: 'expirou sem resposta (nada foi alterado)',
}

/** Linha que o modelo lê no histórico para saber o que o aluno decidiu. */
export function actionHistoryLine(action: TimelineAction, now = Date.now()): string {
  const state = actionState(action, now)
  const note = state === 'failed' && action.result_note ? ` Motivo: ${action.result_note}` : ''
  return `[Proposta "${action.summary}": ${STATE_LABEL[state]}.${note}]`
}
