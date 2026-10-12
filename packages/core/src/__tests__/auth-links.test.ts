import { describe, it, expect } from 'vitest'
import { parseAuthCallback } from '../index'

describe('link de recuperação de senha', () => {
  it('lê a sessão do fragmento', () => {
    const r = parseAuthCallback('https://app.thaix.com/redefinir-senha#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=recovery')
    expect(r).toEqual({ kind: 'session', accessToken: 'a.b.c', refreshToken: 'r1', type: 'recovery' })
  })

  it('funciona com deep link do app', () => {
    const r = parseAuthCallback('thaixskill://redefinir-senha#access_token=x&refresh_token=y&type=recovery')
    expect(r.kind).toBe('session')
  })

  it('link vencido vira mensagem clara', () => {
    const r = parseAuthCallback('https://app/redefinir-senha#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
    expect(r).toEqual({ kind: 'error', message: 'Esse link expirou ou já foi usado. Peça um novo.' })
    expect(parseAuthCallback('https://app/redefinir-senha?error=server_error&error_description=boom').kind).toBe('error')
  })

  it('sem nada na URL', () => {
    expect(parseAuthCallback('https://app/redefinir-senha')).toEqual({ kind: 'empty' })
    expect(parseAuthCallback(null)).toEqual({ kind: 'empty' })
  })
})
