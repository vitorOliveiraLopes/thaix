import { describe, it, expect } from 'vitest'
import { PROPOSAL_TTL_MS, actionHistoryLine, actionState, buildChatTimeline, type TimelineAction, type TimelineMessage } from '../index'

const t0 = Date.parse('2026-10-08T12:00:00Z')
const at = (s: number) => new Date(t0 + s * 1000).toISOString()
const msg = (id: string, role: 'user' | 'assistant', s: number): TimelineMessage => ({ id, role, content: id, created_at: at(s) })
const act = (id: string, s: number, status: TimelineAction['status'] = 'pending'): TimelineAction => ({ id, status, summary: id, result_note: null, created_at: at(s) })

describe('linha do tempo do chat', () => {
  it('coloca a proposta logo depois da resposta do coach daquele turno', () => {
    const timeline = buildChatTimeline(
      [msg('u1', 'user', 0), msg('a1', 'assistant', 5), msg('u2', 'user', 60), msg('a2', 'assistant', 64)],
      [act('p1', 3), act('p2', 62), act('p3', 63)],
      t0 + 70_000,
    )
    expect(timeline.map(e => (e.kind === 'msg' ? e.msg.id : e.action.id))).toEqual(['u1', 'a1', 'p1', 'u2', 'a2', 'p2', 'p3'])
  })

  it('proposta sem resposta salva ainda aparece no fim', () => {
    const timeline = buildChatTimeline([msg('u1', 'user', 0)], [act('p1', 3)], t0 + 10_000)
    expect(timeline.map(e => (e.kind === 'msg' ? e.msg.id : e.action.id))).toEqual(['u1', 'p1'])
  })

  it('ordena entradas fora de ordem', () => {
    const timeline = buildChatTimeline([msg('a1', 'assistant', 5), msg('u1', 'user', 0)], [], t0)
    expect(timeline.map(e => (e.kind === 'msg' ? e.msg.id : ''))).toEqual(['u1', 'a1'])
  })

  it('pendente vencida vira expirada', () => {
    expect(actionState(act('p', 0), t0 + PROPOSAL_TTL_MS - 1)).toBe('pending')
    expect(actionState(act('p', 0), t0 + PROPOSAL_TTL_MS + 1)).toBe('expired')
    expect(actionState(act('p', 0, 'confirmed'), t0 + PROPOSAL_TTL_MS * 10)).toBe('confirmed')
  })

  it('descreve a decisão para o modelo', () => {
    expect(actionHistoryLine(act('Aliviar treino', 0, 'declined'), t0)).toContain('CANCELADA')
    expect(actionHistoryLine({ ...act('X', 0, 'failed'), result_note: 'treino já concluído' }, t0)).toContain('Motivo: treino já concluído')
    expect(actionHistoryLine(act('X', 0, 'confirmed'), t0)).toContain('CONFIRMADA')
  })
})
