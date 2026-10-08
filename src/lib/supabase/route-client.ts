import { createClient as createSupabaseClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { createClient as createCookieClient } from './server'

/**
 * Cliente Supabase para route handlers, autenticado como o aluno que chamou.
 *
 * - App mobile: envia `Authorization: Bearer <access_token>`. O cliente é
 *   criado com esse token, então todas as queries rodam sob RLS como o aluno.
 * - Web: sem o cabeçalho, cai na sessão por cookie (comportamento antigo).
 *
 * Nunca usa a service role: o aluno só lê e grava o que a RLS permite.
 */
export async function getRouteClient(
  req: Request,
): Promise<{ client: SupabaseClient; user: User } | { client: null; user: null }> {
  const header = req.headers.get('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null

  if (token) {
    const client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      },
    )
    const { data, error } = await client.auth.getUser(token)
    if (error || !data.user) return { client: null, user: null }
    return { client, user: data.user }
  }

  const client = (await createCookieClient()) as unknown as SupabaseClient
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return { client: null, user: null }
  return { client, user: data.user }
}
