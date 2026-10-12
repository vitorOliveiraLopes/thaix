import * as Sentry from '@sentry/nextjs'

/**
 * Erro tratado numa rota (que já devolveu uma resposta amigável ao aluno)
 * mas que precisa aparecer no monitoramento. Sem SENTRY_DSN, não faz nada.
 */
export function reportServerError(error: unknown, ctx: { route: string; code?: string; userId?: string }) {
  if (!process.env.SENTRY_DSN) return
  Sentry.withScope(scope => {
    scope.setTag('route', ctx.route)
    if (ctx.code) scope.setTag('code', ctx.code)
    if (ctx.userId) scope.setUser({ id: ctx.userId })
    Sentry.captureException(error)
  })
}
