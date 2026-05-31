import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const STEP_ROUTES: Record<string, string> = {
  'apresentacao':   '/onboarding/apresentacao',
  'motivacao':      '/onboarding/motivacao',
  'como-conheceu':  '/onboarding/como-conheceu',
  'skills':         '/onboarding/skills',
  'trava':          '/onboarding/trava',
  'teste-fisico':   '/onboarding/teste-fisico',
  'frequencia':     '/onboarding/frequencia',
  'peso':           '/onboarding/peso',
  'protocolo':      '/onboarding/protocolo',
  'completo':       '/home',
}

function getOnboardingRedirect(row: Record<string, unknown> | null): string {
  if (!row?.current_step) return '/onboarding/apresentacao'
  return STEP_ROUTES[row.current_step as string] ?? '/onboarding/apresentacao'
}

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

  const protectedRoutes = ['/home', '/treinos', '/cursos', '/perfil', '/comunidade', '/paywall']
  const isProtected = protectedRoutes.some(r => pathname.startsWith(r))

  // Sem sessão → login
  if (!user && (isProtected || pathname.startsWith('/onboarding'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Logado em login/signup → verificar onboarding e redirecionar
  if (user && ['/login', '/signup'].includes(pathname)) {
    const { data } = await supabase
      .from('onboarding_responses')
      .select('current_step')
      .eq('user_id', user.id)
      .maybeSingle()
    return NextResponse.redirect(new URL(getOnboardingRedirect(data), request.url))
  }

  // Logado em rota protegida sem onboarding completo → retomar onboarding
  if (user && pathname === '/home') {
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

  // Só redireciona para /home se tentar acessar /onboarding/apresentacao
  // (entrada do fluxo), não em steps intermediários
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