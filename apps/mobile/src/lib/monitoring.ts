import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

/**
 * Monitoramento de erros (Sentry) no Android e na web.
 *
 * Só liga com EXPO_PUBLIC_SENTRY_DSN definido e fora do modo de
 * desenvolvimento: sem DSN, tudo aqui vira nada. Nunca envia e-mail, nome
 * ou dados de treino: só o id do aluno, para agrupar erros da mesma pessoa.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const enabled = !!dsn && !__DEV__;

if (enabled) {
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? 'production',
    sendDefaultPii: false,
    // Uma amostra das telas para medir lentidão; erros vão todos.
    tracesSampleRate: 0.1,
  });
}

export function setMonitoringUser(userId: string | null) {
  if (enabled) Sentry.setUser(userId ? { id: userId } : null);
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (enabled) Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function withMonitoring<P extends object>(Root: ComponentType<P>): ComponentType<P> {
  return enabled ? (Sentry.wrap(Root as ComponentType<Record<string, unknown>>) as unknown as ComponentType<P>) : Root;
}
