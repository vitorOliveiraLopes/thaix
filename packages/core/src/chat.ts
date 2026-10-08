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

// ─── Anexos (cards nativos nas mensagens do coach) ─────────────────────────────

export type WorkoutAttachment = {
  type: 'workout'
  workout_id: string
  skill_id: string
  week_number: number
  completed: boolean
  /** Duração estimada no momento da mensagem. */
  minutes: number
  items: { name: string; category: string; sets: number; reps: number | null; time_sec: number | null }[]
}

export type ChatAttachment = WorkoutAttachment

/** Aceita só anexos conhecidos e bem formados (vêm do banco como jsonb). */
export function parseAttachments(raw: unknown): ChatAttachment[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (a): a is ChatAttachment =>
      !!a && typeof a === 'object' && (a as { type?: unknown }).type === 'workout' && Array.isArray((a as { items?: unknown }).items),
  )
}

/** "3×8" ou "3×30s". */
export function formatSetsTarget(item: { sets: number; reps: number | null; time_sec: number | null }): string {
  return `${item.sets}×${item.time_sec ? `${item.time_sec}s` : `${item.reps ?? 0}`}`
}

// ─── Texto com formatação leve ─────────────────────────────────────────────────

export type RichSpan = { text: string; bold: boolean }
export type RichBlock =
  | { type: 'paragraph'; spans: RichSpan[] }
  | { type: 'bullet'; spans: RichSpan[] }
  | { type: 'numbered'; n: number; spans: RichSpan[] }

/** **negrito** dentro de uma linha. Asterisco sem par fica como texto. */
export function parseSpans(line: string): RichSpan[] {
  const spans: RichSpan[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) spans.push({ text: line.slice(last, m.index), bold: false })
    spans.push({ text: m[1], bold: true })
    last = m.index + m[0].length
  }
  if (last < line.length) spans.push({ text: line.slice(last), bold: false })
  return spans.length ? spans : [{ text: '', bold: false }]
}

/**
 * Markdown mínimo das respostas do coach: parágrafos, listas com "-", "*" ou
 * "•", listas numeradas e negrito. Títulos (#) viram parágrafo em negrito.
 * Linhas seguidas de um parágrafo continuam o mesmo parágrafo.
 */
export function parseRichText(text: string): RichBlock[] {
  const blocks: RichBlock[] = []
  let open: { type: 'paragraph'; spans: RichSpan[] } | null = null
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) {
      open = null
      continue
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(line)
    const numbered = /^(\d{1,2})[.)]\s+(.*)$/.exec(line)
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    if (bullet) {
      blocks.push({ type: 'bullet', spans: parseSpans(bullet[1]) })
      open = null
    } else if (numbered) {
      blocks.push({ type: 'numbered', n: Number(numbered[1]), spans: parseSpans(numbered[2]) })
      open = null
    } else if (heading) {
      blocks.push({ type: 'paragraph', spans: [{ text: heading[1].replace(/\*\*/g, ''), bold: true }] })
      open = null
    } else if (open) {
      open.spans.push({ text: '\n', bold: false }, ...parseSpans(line))
    } else {
      open = { type: 'paragraph', spans: parseSpans(line) }
      blocks.push(open)
    }
  }
  return blocks
}
