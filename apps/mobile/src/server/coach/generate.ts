import {
  applyOps,
  buildAdaptiveProfile,
  filterByEquipment,
  previousLevel,
  fitWorkoutToMinutes,
  selectExercisesFromPool,
  workoutSeed,
  type CatalogExercise,
  type HistoryItem,
  type HistoryResult,
  type PlanItem,
  type SkillExercise,
} from '@thaix/core'

import type { CoachCtx } from './context'

/**
 * Treino de uma skill montado pelo método, igual ao gerador do app
 * (apps/mobile/src/lib/workouts.ts): nível e semana do aluno, equipamento,
 * perfil adaptativo das últimas sessões e corte por tempo. Só lê; quem grava
 * é a confirmação da proposta, com exatamente estes itens.
 */
export async function planGeneratedWorkout(
  ctx: CoachCtx,
  skillId: string,
  minutes: number | null,
): Promise<{ level: string; weekNumber: number; items: PlanItem[] } | { error: string }> {
  const c = ctx.client
  const [{ data: progress }, { data: routine }] = await Promise.all([
    c.from('user_skill_progress').select('level, week_number, sessions_at_current_level').eq('user_id', ctx.userId).eq('skill_id', skillId).maybeSingle(),
    c.from('onboarding_responses').select('equipment').eq('user_id', ctx.userId).maybeSingle(),
  ])
  if (!progress) return { error: 'Essa skill não está nas trilhas do aluno. Use add_skill antes.' }

  const [{ data: catalog, error: poolError }, profile] = await Promise.all([
    c.from('skill_exercises').select('*').eq('skill_id', skillId).order('order_index'),
    adaptiveProfile(ctx, skillId),
  ])
  if (poolError) return { error: poolError.message }

  // Igual ao app: nível do aluno, com o de baixo para completar abdômen e força.
  const all = (catalog ?? []) as SkillExercise[]
  const equipment = (routine?.equipment as string[] | null) ?? []
  const usableOf = (level: string | null) => {
    const lvl = all.filter(e => e.level === level)
    const usable = filterByEquipment(lvl, equipment)
    return usable.length > 0 ? usable : lvl
  }
  const selected = selectExercisesFromPool({
    pool: usableOf(progress.level),
    lowerPool: usableOf(previousLevel(progress.level)),
    level: progress.level,
    weekNumber: progress.week_number,
    seed: workoutSeed(ctx.userId, ctx.today, progress.week_number),
    profile,
    sessionsAtLevel: progress.sessions_at_current_level ?? 0,
  })
  if (selected.length === 0) return { error: 'Não há exercícios cadastrados para esse nível.' }

  const items: PlanItem[] = selected.map((e, i) => ({
    order_index: i + 1,
    skill_exercise_id: e.id,
    sets: e.sets,
    reps: e.reps,
    time_sec: e.time_sec,
    exercise: e,
  }))
  return {
    level: progress.level,
    weekNumber: progress.week_number,
    items: minutes ? applyOps(items, fitWorkoutToMinutes(items, minutes).ops) : items,
  }
}

async function adaptiveProfile(ctx: CoachCtx, skillId: string) {
  const c = ctx.client
  const { data: recent } = await c
    .from('daily_workouts')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('skill_id', skillId)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })
    .limit(3)
  const ids = (recent ?? []).map(w => w.id as string)
  const [results, previous] = await Promise.all([
    ids.length
      ? c.from('daily_workout_results').select('daily_workout_id, skill_exercise_id, reps_achieved, time_achieved_sec, perceived_effort').in('daily_workout_id', ids)
      : Promise.resolve({ data: [] }),
    ids[1]
      ? c.from('daily_workout_items').select('skill_exercise_id, skill_exercises(category)').eq('daily_workout_id', ids[1])
      : Promise.resolve({ data: [] }),
  ])
  const previousItems: HistoryItem[] = ((previous.data ?? []) as unknown as { skill_exercise_id: string; skill_exercises: { category: string } | null }[]).map(i => ({
    skill_exercise_id: i.skill_exercise_id,
    category: i.skill_exercises?.category ?? null,
  }))
  return buildAdaptiveProfile(ids, (results.data ?? []) as HistoryResult[], previousItems)
}

/** Catálogo da skill (todos os níveis), para recomendar e montar treino personalizado. */
export async function loadCatalog(ctx: CoachCtx, skillId: string): Promise<CatalogExercise[]> {
  const { data, error } = await ctx.client
    .from('skill_exercises')
    .select('id, skill_id, exercise_name, category, level, sets, reps, time_sec, rest_sec, note, equipment')
    .eq('skill_id', skillId)
    .order('order_index')
  if (error) throw new Error(error.message)
  return ((data ?? []) as CatalogExercise[]).map(e => ({ ...e, equipment: e.equipment ?? [] }))
}
