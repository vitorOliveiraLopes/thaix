import { supabase } from './supabase';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://thaix.vercel.app').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * POST na API do ThaixSkill autenticado como o aluno.
 * Envia o access token do Supabase no cabeçalho Authorization; a API roda
 * tudo sob RLS com esse token.
 */
export async function apiPost<T>(path: string, body: unknown, timeoutMs = 30_000): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError('Sua sessão expirou. Entre de novo.', 401);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string } & T;
    if (!res.ok) throw new ApiError(payload.error ?? 'Erro no servidor', res.status);
    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error)?.name === 'AbortError') throw new ApiError('O servidor demorou para responder.', 408);
    throw new ApiError('Sem conexão com o servidor. Confira sua internet.', 0);
  } finally {
    clearTimeout(timer);
  }
}
