/**
 * ThaixSkill — Links de e-mail do Supabase Auth (sem I/O)
 *
 * O link de "esqueci minha senha" volta para o app com a sessão de
 * recuperação no fragmento da URL (#access_token=...&refresh_token=...&type=recovery)
 * ou com um erro (#error=...&error_description=...; às vezes na query).
 */

export type AuthCallback =
  | { kind: 'session'; accessToken: string; refreshToken: string; type: string | null }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }

function paramsOf(url: string): URLSearchParams {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : ''
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : ''
  // O fragmento tem prioridade (é onde o Supabase põe a sessão).
  const merged = new URLSearchParams(query)
  for (const [k, v] of new URLSearchParams(hash)) merged.set(k, v)
  return merged
}

export function parseAuthCallback(url: string | null | undefined): AuthCallback {
  if (!url) return { kind: 'empty' }
  const p = paramsOf(url)
  const error = p.get('error_description') ?? p.get('error')
  if (error) {
    const expired = /expired|invalid/i.test(error) || p.get('error_code') === 'otp_expired'
    return { kind: 'error', message: expired ? 'Esse link expirou ou já foi usado. Peça um novo.' : 'Não foi possível abrir esse link. Peça um novo.' }
  }
  const accessToken = p.get('access_token')
  const refreshToken = p.get('refresh_token')
  if (accessToken && refreshToken) return { kind: 'session', accessToken, refreshToken, type: p.get('type') }
  return { kind: 'empty' }
}
