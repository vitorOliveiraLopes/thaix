import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Onboarding step → route map ─────────────────────────────────────────────

const STEP_ROUTES: Record<string, string> = {
  'apresentacao':  '/onboarding/apresentacao',
  'motivacao':     '/onboarding/motivacao',
  'como-conheceu': '/onboarding/como-conheceu',
  'skills':        '/onboarding/skills',
  'trava':         '/onboarding/trava',
  'teste-fisico':  '/onboarding/teste-fisico',
  'frequencia':    '/onboarding/frequencia',
  'peso':          '/onboarding/peso',
  'protocolo':     '/onboarding/protocolo',
  'completo':      '/home',
}

function getOnboardingRedirect(row: Record<string, unknown> | null): string {
  if (!row?.current_step) return '/onboarding/apresentacao'
  return STEP_ROUTES[row.current_step as string] ?? '/onboarding/apresentacao'
}

// ─── Trial expiry check ───────────────────────────────────────────────────────
//
// Retorna true se o aluno está com trial expirado e sem assinatura ativa.
// Alunos com status 'active' nunca são bloqueados.
// Alunos sem user_settings (edge case de trigger falho) não são bloqueados
// para não criar loop de redirecionamento.

function isTrialExpired(settings: {
  subscription_status: string
  trial_ends_at: string | null
} | null): boolean {
  if (!settings) return false
  if (settings.subscription_status === 'active') return false
  if (settings.subscription_status !== 'trial') return false
  if (!settings.trial_ends_at) return false
  return new Date(settings.trial_ends_at).getTime() < Date.now()
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  const protectedRoutes = ['/home', '/treinos', '/cursos', '/perfil', '/comunidade']
  const isProtected = protectedRoutes.some(r => pathname.startsWith(r))

  // ── Sem sessão → login ────────────────────────────────────────────────────
  if (!user && (isProtected || pathname.startsWith('/onboarding'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ── Logado em login/signup → retomar onboarding ou ir para home ──────────
  if (user && ['/login', '/signup'].includes(pathname)) {
    const { data } = await supabase
      .from('onboarding_responses')
      .select('current_step')
      .eq('user_id', user.id)
      .maybeSingle()
    return NextResponse.redirect(new URL(getOnboardingRedirect(data), request.url))
  }

  // ── Verificações para usuários logados em rotas protegidas ────────────────
  if (user && isProtected) {

    // 1. Onboarding incompleto → retomar step
    if (pathname === '/home') {
      const { data } = await supabase
        .from('onboarding_responses')
        .select('current_step')
        .eq('user_id', user.id)
        .maybeSingle()
      const redirect = getOnboardingRedirect(data)
      if (redirect !== '/home') {
        return NextResponse.redirect(new URL(redirect, request.url))
      }
    }

    // 2. Trial expirado → paywall
    //    Só bloqueia rotas do app principal, não /perfil (para não prender o aluno)
    //    e não /paywall (evitar loop)
    const isAppRoute = ['/home', '/treinos', '/cursos', '/comunidade'].some(
      r => pathname.startsWith(r)
    )

    if (isAppRoute) {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('subscription_status, trial_ends_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (isTrialExpired(settings)) {
        return NextResponse.redirect(new URL('/paywall', request.url))
      }
    }
  }

  // ── Onboarding já completo → não deixar voltar para apresentacao ──────────
  if (user && pathname === '/onboarding/apresentacao') {
    const { data } = await supabase
      .from('onboarding_responses')
      .select('current_step')
      .eq('user_id', user.id)
      .maybeSingle()
    const redirect = getOnboardingRedirect(data)
    if (redirect !== '/onboarding/apresentacao') {
      return NextResponse.redirect(new URL(redirect, request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/home/:path*', '/treinos/:path*', '/cursos/:path*',
    '/perfil/:path*', '/comunidade/:path*', '/paywall/:path*',
    '/onboarding/:path*', '/login', '/signup',
  ],
}
