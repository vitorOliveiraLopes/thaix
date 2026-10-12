import { NextRequest, NextResponse } from 'next/server'
import { getRouteClient } from '@/lib/supabase/route-client'
import {
  sessionMetAllGoalsMultiSet,
  shouldProgressLevel,
  nextLevel,
  evaluateAchievements as evaluateAchievementsRule,
  detectNewPRs,
  bestOfSets,
  type ExerciseResult as RuleExerciseResult,
  type AchievementRule,
  type Protocol,
  type MultiSetExerciseGoal,
  type MultiSetExerciseResult,
} from '@thaix/core'
import { reportServerError } from '@/lib/monitoring/server'

// ─── Types ───────────────────────────────────────────────────────────────────

type WorkoutResult = {
  skill_exercise_id: string
  // Valores por série (novo) — usados para o critério de progressão de
  // 2/3 séries e para calcular a melhor série (PR).
  reps_per_set?: (number | null)[]
  time_per_set?: (number | null)[]
  // Mantidos para compatibilidade: sempre calculados como a MELHOR série
  // antes do envio. PRs e resumos continuam usando estes dois campos.
  reps_achieved?: number
  time_achieved_sec?: number
  perceived_effort: number
}

type RequestBody = {
  workoutId: string
  results: WorkoutResult[]
}

// ─── Clientes Supabase ────────────────────────────────────────────────────────


// SERVICE_ROLE_KEY não necessária — usando sessão do usuário via RLS
type AdminClient = any

// ─── Lógica de negócio (I/O) ──────────────────────────────────────────────────
//
// Estas funções continuam responsáveis por buscar/gravar no Supabase.
// As DECISÕES (bateu meta? deve progredir? qual conquista desbloqueia?)
// agora vêm de @thaix/core (packages/core/src/business-rules.ts) — funções puras, testadas em
// src/lib/__tests__/business-rules.test.ts, sem I/O.

async function saveResults(
  admin: any,
  workoutId: string,
  results: WorkoutResult[]
): Promise<void> {
  const rows = results.map(r => {
    // reps_achieved/time_achieved_sec sempre recalculados no servidor a
    // partir das séries — nunca confiamos no valor "resumo" vindo do
    // cliente. Isso também cobre exercícios de 1 série (array com 1 item).
    const bestReps = r.reps_per_set?.length ? bestOfSets(r.reps_per_set) : r.reps_achieved
    const bestTime = r.time_per_set?.length ? bestOfSets(r.time_per_set) : r.time_achieved_sec

    return {
      daily_workout_id:  workoutId,
      skill_exercise_id: r.skill_exercise_id,
      reps_achieved:     bestReps ?? null,
      time_achieved_sec: bestTime ?? null,
      reps_per_set:      r.reps_per_set ?? null,
      time_per_set:      r.time_per_set ?? null,
      perceived_effort:  r.perceived_effort,
      completed_at:      new Date().toISOString(),
    }
  })

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

  // Treinos ajustados pelo coach (encurtados/aliviados) não contam para subir
  // de nível. Sem a coluna `adjusted` (SQL da fase 2 não rodado), cai na
  // consulta antiga.
  const recent = (withAdjusted: boolean) => {
    let q = admin
      .from('daily_workouts')
      .select('id')
      .eq('user_id', userId)
      .eq('skill_id', skillId)
      .not('completed_at', 'is', null)
    if (withAdjusted) q = q.eq('adjusted', false)
    return q.order('completed_at', { ascending: false }).limit(2)
  }
  let { data: lastWorkouts, error: recentError } = await recent(true)
  if (recentError) ({ data: lastWorkouts } = await recent(false))

  if (!lastWorkouts || lastWorkouts.length < 2) return

  const workoutIds = (lastWorkouts as any[]).map((w: any) => w.id)
  const [resultsRes, itemsRes] = await Promise.all([
    admin
      .from('daily_workout_results')
      .select('reps_achieved, time_achieved_sec, reps_per_set, time_per_set, perceived_effort, daily_workout_id, skill_exercise_id')
      .in('daily_workout_id', workoutIds),
    admin
      .from('daily_workout_items')
      .select('skill_exercise_id, sets, reps, time_sec, daily_workout_id')
      .in('daily_workout_id', workoutIds),
  ])

  const results = (resultsRes.data ?? []) as any[]
  const items   = (itemsRes.data   ?? []) as any[]
  if (results.length === 0) return

  // Usa as funções puras de business-rules.ts para decidir se cada sessão
  // bateu a meta — critério de 2/3 séries por exercício, não mais "tudo
  // ou nada". Compatível com resultados antigos (sem reps_per_set salvo):
  // nesse caso o array cai para [reps_achieved], mantendo o comportamento
  // anterior automaticamente.
  const sessionsAllMetGoal: boolean[] = workoutIds.map((wid: string) => {
    const sGoals: MultiSetExerciseGoal[] = items
      .filter((i: any) => i.daily_workout_id === wid)
      .map((i: any) => ({
        skill_exercise_id: i.skill_exercise_id,
        sets:              i.sets ?? 1,
        reps:              i.reps,
        time_sec:          i.time_sec,
      }))

    const sResults: MultiSetExerciseResult[] = results
      .filter((r: any) => r.daily_workout_id === wid)
      .map((r: any) => ({
        skill_exercise_id: r.skill_exercise_id,
        reps_per_set:      (r.reps_per_set && r.reps_per_set.length > 0)
          ? r.reps_per_set
          : (r.reps_achieved !== null && r.reps_achieved !== undefined ? [r.reps_achieved] : []),
        time_per_set:      (r.time_per_set && r.time_per_set.length > 0)
          ? r.time_per_set
          : (r.time_achieved_sec !== null && r.time_achieved_sec !== undefined ? [r.time_achieved_sec] : []),
        perceived_effort:  r.perceived_effort ?? 3,
      }))

    return sessionMetAllGoalsMultiSet(sGoals, sResults)
  })

  const ruleResults: RuleExerciseResult[] = results.map((r: any) => ({
    skill_exercise_id: r.skill_exercise_id,
    reps_achieved:     r.reps_achieved,
    time_achieved_sec: r.time_achieved_sec,
    perceived_effort:  r.perceived_effort ?? 3,
  }))

  const shouldProgress = shouldProgressLevel({
    currentLevel: currentLevel as Protocol,
    sessionsAllMetGoal,
    results: ruleResults,
  })

  if (!shouldProgress) return

  const nextLvl = nextLevel(currentLevel as Protocol)

  await Promise.all([
    admin.from('user_skill_progress').update({
      level: nextLvl, week_number: currentWeek + 1,
      sessions_at_current_level: 0,
      level_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId).eq('skill_id', skillId),
    admin.from('skill_level_history').insert({
      user_id: userId, skill_id: skillId,
      from_level: currentLevel, to_level: nextLvl,
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

  const existingBests = ((existingPRs ?? []) as any[]).map((pr: any) => ({
    exerciseId: pr.exercise_id as string,
    value:      pr.value as number,
    unit:       pr.unit as 'reps' | 'seconds',
  }))

  const ruleResults: RuleExerciseResult[] = results.map(r => ({
    skill_exercise_id: r.skill_exercise_id,
    reps_achieved:     r.reps_achieved,
    time_achieved_sec: r.time_achieved_sec,
    perceived_effort:  r.perceived_effort,
  }))

  // Decisão de quais são realmente novos PRs vem de business-rules.ts
  const newPRs = detectNewPRs(existingBests, ruleResults)

  if (newPRs.length === 0) return

  const today = new Date().toISOString().split('T')[0]
  await admin.from('pr_entries').insert(
    newPRs.map(pr => ({
      user_id:     userId,
      exercise_id: pr.exerciseId,
      value:       pr.value,
      unit:        pr.unit,
      date:        today,
      notes:       'Registrado automaticamente',
    }))
  )
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

  const rules: AchievementRule[] = ((allRes.data ?? []) as any[]).map((a: any) => ({
    id:                 a.id,
    type:               a.type,
    threshold:          a.threshold,
    skill_exercise_id:  a.skill_exercise_id,
    skill_id:           a.skill_id,
    target_level:       a.target_level,
  }))

  const alreadyUnlockedIds = new Set(
    ((unlockedRes.data ?? []) as any[]).map((u: any) => u.achievement_id)
  )
  const totalWorkoutsCompleted = totalRes.count ?? 0
  const latestLevelRow = levelRes.data?.[0] ?? null
  const latestLevelUp = latestLevelRow
    ? { skillId: latestLevelRow.skill_id as string, toLevel: latestLevelRow.to_level as string }
    : null

  const { data: executed } = await admin
    .from('daily_workout_items')
    .select('skill_exercise_id, daily_workouts!inner(user_id, completed_at)')
    .eq('daily_workouts.user_id', userId)
    .not('daily_workouts.completed_at', 'is', null)

  const executedExerciseIds = new Set(
    ((executed ?? []) as any[]).map((i: any) => i.skill_exercise_id)
  )

  // Decisão de quais conquistas desbloqueiam vem de business-rules.ts
  const toUnlock = evaluateAchievementsRule(rules, {
    totalWorkoutsCompleted,
    executedExerciseIds,
    latestLevelUp,
    alreadyUnlockedIds,
  })

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
    // ── Passo 1: autenticação (Bearer do app ou cookie da web) ───────────────
    const { client: authClient, user } = await getRouteClient(req)

    if (!authClient || !user) {
      console.error('[complete] Auth failed', {
        hasBearer: req.headers.get('authorization')?.toLowerCase().startsWith('bearer ') ?? false,
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

    // ── Passo 4: normalizar resultados (melhor série calculada uma vez,
    // usada tanto para salvar quanto para PRs — fonte única de verdade)
    const normalizedResults: WorkoutResult[] = results.map(r => ({
      ...r,
      reps_achieved:     r.reps_per_set?.length ? bestOfSets(r.reps_per_set) : r.reps_achieved,
      time_achieved_sec: r.time_per_set?.length ? bestOfSets(r.time_per_set) : r.time_achieved_sec,
    }))

    const admin = authClient
    await saveResults(admin, workoutId, normalizedResults)
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
      checkAndInsertAutoPRs(admin, user.id, normalizedResults),
    ])

    const newAchievements = await evaluateAchievements(admin, user.id, workoutId, skillId)

    return NextResponse.json({ success: true, newAchievements })

  } catch (err) {
    reportServerError(err, { route: 'workouts/complete' })
    console.error('[complete] Unexpected error', {
      message: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
