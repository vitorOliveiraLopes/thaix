import * as Sentry from '@sentry/nextjs'

/**
 * Monitoramento de erros da API (Sentry). Só liga com SENTRY_DSN definido
 * na Vercel. Não envia conteúdo de requisição; o id do aluno entra só quando
 * a rota marca explicitamente (ver reportServerError).
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? 'development',
    // Nada do conteúdo das requisições: o corpo do chat pode ter dados de
    // saúde e o cabeçalho tem o token do aluno.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
    },
    tracesSampleRate: 0.1,
  })
}

// Erros não tratados em rotas e páginas.
export const onRequestError = Sentry.captureRequestError
