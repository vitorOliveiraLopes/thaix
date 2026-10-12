import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

/**
 * Cliente Supabase para as rotas da API, autenticado como o aluno que chamou.
 *
 * O app (Android e web) envia `Authorization: Bearer <access_token>`. O
 * cliente é criado com esse token, então todas as queries rodam sob RLS como
 * o aluno. Nunca usa a service role: o aluno só lê e grava o que a RLS permite.
 */
export async function getRouteClient(
  req: Request,
): Promise<{ client: SupabaseClient; user: User } | { client: null; user: null }> {
  const header = req.headers.get('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null
  if (!token) return { client: null, user: null }

  const client = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return { client: null, user: null }
  return { client, user: data.user }
}
