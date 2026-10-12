/**
 * Monitoramento de erros da API (Sentry), sem SDK: um POST no endpoint de
 * envelopes do Sentry. O SDK de servidor do Sentry não é feito para o
 * empacotador do Expo, e aqui só precisamos de "erro + rota + código".
 *
 * Liga com SENTRY_DSN (variável de servidor, sem EXPO_PUBLIC_). Nunca envia o
 * conteúdo da requisição (o chat pode ter dados de saúde) nem o token; o id
 * do aluno entra só quando a rota informa.
 */

type Ctx = { route: string; code?: string; userId?: string }

function parseDsn(dsn: string): { url: string; key: string } | null {
  const m = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(dsn.trim())
  if (!m) return null
  const [, key, host, projectId] = m
  return { url: `https://${host}/api/${projectId}/envelope/?sentry_key=${key}&sentry_version=7`, key }
}

function eventId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/-/g, '').slice(0, 32).padEnd(32, '0')
}

export async function reportServerError(error: unknown, ctx: Ctx): Promise<void> {
  const dsn = process.env.SENTRY_DSN
  const target = dsn ? parseDsn(dsn) : null
  if (!target) return

  const err = error instanceof Error ? error : new Error(String(error))
  const id = eventId()
  const event = {
    event_id: id,
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: 'error',
    environment: process.env.VERCEL_ENV ?? 'development',
    tags: { route: ctx.route, ...(ctx.code ? { code: ctx.code } : {}) },
    ...(ctx.userId ? { user: { id: ctx.userId } } : {}),
    exception: { values: [{ type: err.name, value: err.message.slice(0, 500) }] },
    extra: { stack: err.stack?.slice(0, 4000) },
  }
  const body = [JSON.stringify({ event_id: id, sent_at: new Date().toISOString() }), JSON.stringify({ type: 'event' }), JSON.stringify(event)].join('\n')

  // Curto de propósito: a resposta ao aluno não espera o monitoramento.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 1500)
  try {
    await fetch(target.url, { method: 'POST', body, signal: controller.signal, headers: { 'Content-Type': 'application/x-sentry-envelope' } })
  } catch {
    // Monitoramento nunca derruba a rota.
  } finally {
    clearTimeout(timer)
  }
}
