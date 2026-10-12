import { afterEach, describe, expect, it, vi } from 'vitest'
import { reportServerError } from '../monitoring'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('reportServerError', () => {
  it('sem SENTRY_DSN não chama nada', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('SENTRY_DSN', '')
    await reportServerError(new Error('x'), { route: 'chat' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envia o envelope para o projeto do DSN, só com erro, rota e código', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('SENTRY_DSN', 'https://abc123@o1.ingest.sentry.io/42')
    await reportServerError(new Error('falhou'), { route: 'chat', code: 'internal', userId: 'u1' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://o1.ingest.sentry.io/api/42/envelope/?sentry_key=abc123&sentry_version=7')
    const [, item, event] = String(init.body).split('\n').map(l => JSON.parse(l))
    expect(item).toEqual({ type: 'event' })
    expect(event.tags).toEqual({ route: 'chat', code: 'internal' })
    expect(event.user).toEqual({ id: 'u1' })
    expect(event.exception.values[0]).toEqual({ type: 'Error', value: 'falhou' })
  })

  it('falha de rede não derruba a rota', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    vi.stubEnv('SENTRY_DSN', 'https://abc123@o1.ingest.sentry.io/42')
    await expect(reportServerError('erro solto', { route: 'confirm' })).resolves.toBeUndefined()
  })
})
