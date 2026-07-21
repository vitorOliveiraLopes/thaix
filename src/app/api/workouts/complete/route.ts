import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ─── Types ───────────────────────────────────────────────────────────────────

type WorkoutResult = {
  skill_exercise_id: string
  reps_achieved?: number
  time_achieved_sec?: number
  perceived_effort: number
}

type RequestBody = {
  workoutId: string
  results: WorkoutResult[]
}

// ─── Clientes Supabase ────────────────────────────────────────────────────────

async function createAuthClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// SERVICE_ROLE_KEY não necessária — usando sessão do usuário via RLS
type AdminClient = any

// ─── Lógica de negócio ───────────────────────────────────────────────────────

async function saveResults(
  admin: any,
  workoutId: string,
  results: WorkoutResult[]
): Promise<void> {
  const rows = results.map(r => ({
    daily_workout_id:  workoutId,
    skill_exercise_id: r.skill_exercise_id,
    reps_achieved:     r.reps_achieved     ?? null,
    time_achieved_sec: r.time_achieved_sec ?? null,
    perceived_effort:  r.perceived_effort,
    completed_at:      new Date().toISOString(),
  }))

  const { error } = await admin
    .from('daily_workout_results')
    .upsert(rows, { onConflict: 'daily_workout_id,skill_exercise_id' })

  if (error) throw new Error(`saveResults: ${error.message}`)
}

async function markWorkoutComplete(
  admin: any,
  workoutId: string,
  userId: string
): Promise<{ skill_id: string; week_number: number }> {
  const { data, error } = await admin
    .from('daily_workouts')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', workoutId)
    .eq('user_id', userId)
    .select('skill_id, week_number')
    .single()

  if (error || !data) throw new Error('Treino não encontrado ou acesso negado')
  return data
}

async function checkLevelProgression(
  admin: any,
  userId: string,
  skillId: string,
  currentLevel: string,
  currentWeek: number
): Promise<void> {
  if (currentLevel === 'avancado') return

  const { data: lastWorkouts } = await admin
    .from('daily_workouts')
    .select('id')
    .eq('user_id', userId)
    .eq('skill_id', skillId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(2)

  if (!lastWorkouts || lastWorkouts.length < 2) return

  const workoutIds = (lastWorkouts as any[]).map((w: any) => w.id)
  const [resultsRes, itemsRes] = await Promise.all([
    admin
      .from('daily_workout_results')
      .select('reps_achieved, time_achieved_sec, perceived_effort, daily_workout_id, skill_exercise_id')
      .in('daily_workout_id', workoutIds),
    admin
      .from('daily_workout_items')
      .select('skill_exercise_id, reps, time_sec, daily_workout_id')
      .in('daily_workout_id', workoutIds),
  ])

  const results = resultsRes.data ?? []
  const items   = itemsRes.data   ?? []
  if (results.length === 0) return

  const metGoal = workoutIds.every(wid => {
    const sResults = (results as any[]).filter((r: any) => r.daily_workout_id === wid)
    const sItems   = (items as any[]).filter((i: any) => i.daily_workout_id === wid)
    if (!sResults.length || !sItems.length) return false
    return sResults.every((r: any) => {
      const item = sItems.find((i: any) => i.skill_exercise_id === r.skill_exercise_id)
      if (!item) return false
      if (item.reps)     return (r.reps_achieved     ?? 0) >= item.reps
      if (item.time_sec) return (r.time_achieved_sec ?? 0) >= item.time_sec
      return false
    })
  })

  if (!metGoal) return

  const avgEffort =
    results.reduce((sum, r) => sum + (r.perceived_effort ?? 3), 0) / results.length
  if (avgEffort > 2.5) return

  const nextLevel = currentLevel === 'iniciante' ? 'intermediario' : 'avancado'
  await Promise.all([
    admin.from('user_skill_progress').update({
      level: nextLevel, week_number: currentWeek + 1,
      sessions_at_current_level: 0,
      level_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId).eq('skill_id', skillId),
    admin.from('skill_level_history').insert({
      user_id: userId, skill_id: skillId,
      from_level: currentLevel, to_level: nextLevel,
      week_number: currentWeek, changed_at: new Date().toISOString(),
    }),
  ])
}

async function incrementSessionCount(
  admin: any, userId: string, skillId: string
): Promise<void> {
  const { data: current } = await admin
    .from('user_skill_progress')
    .select('sessions_at_current_level')
    .eq('user_id', userId).eq('skill_id', skillId).single()

  await admin.from('user_skill_progress').update({
    sessions_at_current_level: (current?.sessions_at_current_level ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('skill_id', skillId)
}

async function checkAndInsertAutoPRs(
  admin: any, userId: string, results: WorkoutResult[]
): Promise<void> {
  const exerciseIds = results.map((r: WorkoutResult) => r.skill_exercise_id)
  const { data: existingPRs } = await admin
    .from('pr_entries').select('exercise_id, value, unit')
    .eq('user_id', userId).in('exercise_id', exerciseIds)

  const bestPRMap = new Map<string, number>()
  for (const pr of (existingPRs ?? [])) {
    const key = `${pr.exercise_id}|${pr.unit}`
    const cur = bestPRMap.get(key)
    if (cur === undefined || pr.value > cur) bestPRMap.set(key, pr.value)
  }

  const today = new Date().toISOString().split('T')[0]
  const newPRs: object[] = []
  for (const r of results) {
    if ((r.reps_achieved ?? 0) > 0) {
      const key = `${r.skill_exercise_id}|reps`
      if ((bestPRMap.get(key) ?? -1) < r.reps_achieved!)
        newPRs.push({ user_id: userId, exercise_id: r.skill_exercise_id,
          value: r.reps_achieved, unit: 'reps', date: today, notes: 'Registrado automaticamente' })
    }
    if ((r.time_achieved_sec ?? 0) > 0) {
      const key = `${r.skill_exercise_id}|seconds`
      if ((bestPRMap.get(key) ?? -1) < r.time_achieved_sec!)
        newPRs.push({ user_id: userId, exercise_id: r.skill_exercise_id,
          value: r.time_achieved_sec, unit: 'seconds', date: today, notes: 'Registrado automaticamente' })
    }
  }
  if (newPRs.length > 0) await admin.from('pr_entries').insert(newPRs)
}

async function evaluateAchievements(
  admin: any, userId: string, workoutId: string, skillId: string
): Promise<string[]> {
  const [allRes, unlockedRes, totalRes, levelRes] = await Promise.all([
    admin.from('achievements').select('id, type, threshold, skill_exercise_id, skill_id, target_level'),
    admin.from('user_achievements').select('achievement_id').eq('user_id', userId),
    admin.from('daily_workouts').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).not('completed_at', 'is', null),
    admin.from('skill_level_history').select('to_level, skill_id')
      .eq('user_id', userId).eq('skill_id', skillId)
      .order('changed_at', { ascending: false }).limit(1),
  ])

  const all         = (allRes.data ?? []) as any[]
  const unlockedIds = new Set((unlockedRes.data ?? []).map((u: any) => u.achievement_id))
  const total       = totalRes.count ?? 0
  const latestLevel = levelRes.data?.[0] ?? null

  const { data: executed } = await admin
    .from('daily_workout_items')
    .select('skill_exercise_id, daily_workouts!inner(user_id, completed_at)')
    .eq('daily_workouts.user_id', userId)
    .not('daily_workouts.completed_at', 'is', null)

  const executedIds = new Set((executed ?? []).map((i: any) => i.skill_exercise_id))
  const toUnlock: string[] = []

  for (const a of all) {
    if (unlockedIds.has(a.id)) continue
    if (a.type === 'session_count' && total >= (a.threshold ?? 0)) toUnlock.push(a.id)
    else if (a.type === 'skill_exercise' && a.skill_exercise_id && executedIds.has(a.skill_exercise_id)) toUnlock.push(a.id)
    else if (a.type === 'skill_level' && latestLevel && a.skill_id === skillId && a.target_level === latestLevel.to_level) toUnlock.push(a.id)
  }

  if (toUnlock.length === 0) return []

  await admin.from('user_achievements').upsert(
    toUnlock.map(achievement_id => ({
      user_id: userId, achievement_id,
      unlocked_at: new Date().toISOString(), shared: false,
    })),
    { onConflict: 'user_id,achievement_id' }
  )
  return toUnlock
}

// ─── POST /api/workouts/complete ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Passo 1: tentar autenticação via cookie ──────────────────────────────
    const authClient = await createAuthClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()

    // Log completo para diagnóstico — aparece no terminal do next dev e no Vercel Functions Log
    if (authError || !user) {
      const allCookies = req.cookies.getAll()
      console.error('[complete] Auth failed', {
        authError:      authError?.message ?? null,
        cookieNames:    allCookies.map(c => c.name),
        hasSbCookie:    allCookies.some(c => c.name.startsWith('sb-')),
      })
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // ── Passo 2: validar body ────────────────────────────────────────────────
    let body: RequestBody
    try { body = await req.json() }
    catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }) }

    const { workoutId, results } = body
    if (!workoutId || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: 'workoutId e results são obrigatórios' },
        { status: 400 }
      )
    }

    // ── Passo 3: verificar ownership via authClient + RLS ───────────────────
    // O authClient usa a sessão do usuário — a RLS garante que ele só enxerga
    // seus próprios workouts. Se retornar null, o treino não pertence a ele.
    // Esta abordagem funciona mesmo sem SERVICE_ROLE_KEY configurada.
    const { data: owned, error: ownershipError } = await authClient
      .from('daily_workouts')
      .select('id')
      .eq('id', workoutId)
      .single()

    if (!owned) {
      console.error('[complete] Ownership check failed', {
        workoutId,
        sessionUserId: user.id,
        dbError:       ownershipError?.message ?? null,
      })
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

        // ── Passo 4: executar lógica de negócio com authClient (sessão do usuário + RLS)
    // Não depende de SERVICE_ROLE_KEY — a RLS garante que o usuário só
    // escreve nos próprios dados.
    const admin = authClient
    await saveResults(admin, workoutId, results)
    const workout = await markWorkoutComplete(admin, workoutId, user.id)
    const skillId = workout.skill_id

    const { data: progress } = await admin
      .from('user_skill_progress')
      .select('level, week_number')
      .eq('user_id', user.id)
      .eq('skill_id', skillId)
      .single()

    await Promise.all([
      incrementSessionCount(admin, user.id, skillId),
      checkLevelProgression(admin, user.id, skillId,
        progress?.level ?? 'iniciante', progress?.week_number ?? 1),
      checkAndInsertAutoPRs(admin, user.id, results),
    ])

    const newAchievements = await evaluateAchievements(admin, user.id, workoutId, skillId)

    return NextResponse.json({ success: true, newAchievements })

  } catch (err) {
    console.error('[complete] Unexpected error', {
      message: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
