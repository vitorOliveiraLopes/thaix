import { NextResponse, type NextRequest } from 'next/server'

/**
 * CORS da API para o app web (Expo na web, em outro domínio).
 *
 * O Android não passa por CORS; o navegador sim, e como a API usa o
 * cabeçalho Authorization, toda chamada começa com um OPTIONS (preflight).
 * Só os domínios de WEB_APP_ORIGINS (separados por vírgula) são aceitos; em
 * desenvolvimento, também o servidor local do Expo.
 */
const DEV_ORIGINS = ['http://localhost:8081', 'http://localhost:19006']

function allowedOrigins(): string[] {
  const configured = (process.env.WEB_APP_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  return process.env.NODE_ENV === 'production' ? configured : [...configured, ...DEV_ORIGINS]
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    // sentry-trace e baggage: o Sentry do app liga a chamada ao erro no servidor.
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, sentry-trace, baggage',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin')
  const allowed = origin !== null && allowedOrigins().includes(origin)
  if (request.method === 'OPTIONS') {
    if (allowed) return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
    // Aparece nos logs da Vercel e na aba Network: mostra exatamente qual
    // domínio falta em WEB_APP_ORIGINS (sem expor a lista configurada).
    console.warn('[cors] origem recusada', { origin, configured: allowedOrigins().length })
    return new NextResponse(`CORS: origem não liberada (${origin ?? 'sem Origin'}). Inclua em WEB_APP_ORIGINS no projeto da API.`, {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  const response = NextResponse.next()
  if (allowed) for (const [k, v] of Object.entries(corsHeaders(origin))) response.headers.set(k, v)
  return response
}

export const config = { matcher: '/api/:path*' }
