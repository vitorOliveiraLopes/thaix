import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { proxy } from '../proxy'

const req = (method: string, origin?: string) =>
  new NextRequest('https://thaix.vercel.app/api/chat', { method, headers: origin ? { origin } : {} })

describe('CORS da API para o app web', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('responde o preflight do domínio liberado', async () => {
    vi.stubEnv('WEB_APP_ORIGINS', 'https://app.thaixskill.com.br, https://outro.app/')
    const res = await proxy(req('OPTIONS', 'https://outro.app'))
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://outro.app')
    expect(res.headers.get('access-control-allow-headers')).toContain('Authorization')
  })

  it('recusa domínio que não está na lista', async () => {
    vi.stubEnv('WEB_APP_ORIGINS', 'https://app.thaixskill.com.br')
    vi.stubEnv('NODE_ENV', 'production')
    const res = await proxy(req('OPTIONS', 'https://malicioso.com'))
    expect(res.status).toBe(403)
    const post = await proxy(req('POST', 'https://malicioso.com'))
    expect(post.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('o Expo local só vale fora de produção', async () => {
    vi.stubEnv('WEB_APP_ORIGINS', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect((await proxy(req('OPTIONS', 'http://localhost:8081'))).status).toBe(403)
    vi.stubEnv('NODE_ENV', 'development')
    expect((await proxy(req('OPTIONS', 'http://localhost:8081'))).status).toBe(204)
  })

  it('app Android (sem Origin) passa sem cabeçalho de CORS', async () => {
    const res = await proxy(req('POST'))
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    expect(res.status).toBe(200)
  })
})
