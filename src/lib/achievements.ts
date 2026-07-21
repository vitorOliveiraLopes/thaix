import { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────────────

type AchievementRow = {
  id: string
  type: 'session_count' | 'skill_exercise' | 'skill_level'
  threshold: number | null
  skill_exercise_id: string | null
  skill_id: string | null
  target_level: string | null
}

// ─── evaluateAchievements ────────────────────────────────────────────────────
//
// Chamada após completeWorkout com o workoutId recém-concluído.
// Avalia os 3 tipos de conquista contra o estado atual do aluno:
//
//   session_count  — N treinos concluídos (contados em daily_workouts)
//   skill_exercise — executou um skill_exercise pela primeira vez
//                    (detectado pelos itens do treino atual)
//   skill_level    — avançou para um nível específico numa skill
//                    (detectado pelo skill_level_history)
//
// Retorna os IDs das conquistas recém-desbloqueadas (para o modal).

export async function evaluateAchievements(
  supabase: SupabaseClient,
  userId: string,
  completedWorkoutId: string,
  skillId: string
): Promise<string[]> {
  const [achievementsRes, unlockedRes, totalWorkoutsRes, workoutItemsRes, levelHistoryRes] =
    await Promise.all([
      supabase.from('achievements').select('*'),
      supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', userId),
      // Total de treinos concluídos no sistema atual
      supabase
        .from('daily_workouts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('completed_at', 'is', null),
      // Exercícios do treino que acabou de ser concluído
      supabase
        .from('daily_workout_items')
        .select('skill_exercise_id')
        .eq('daily_workout_id', completedWorkoutId),
      // Avanços de nível mais recentes desta skill (para conquistas skill_level)
      supabase
        .from('skill_level_history')
        .select('to_level, skill_id')
        .eq('user_id', userId)
        .eq('skill_id', skillId)
        .order('changed_at', { ascending: false })
        .limit(1),
    ])

  const allAchievements = (achievementsRes.data ?? []) as AchievementRow[]
  const unlockedIds = new Set((unlockedRes.data ?? []).map((u: any) => u.achievement_id))
  const totalWorkouts = totalWorkoutsRes.count ?? 0
  const workoutExerciseIds = new Set(
    (workoutItemsRes.data ?? []).map((i: any) => i.skill_exercise_id)
  )
  const latestLevelUp = levelHistoryRes.data?.[0] ?? null

  // Todos os skill_exercise_ids já executados pelo aluno (para skill_exercise)
  const { data: allExecutedItems } = await supabase
    .from('daily_workout_items')
    .select('skill_exercise_id, daily_workouts!inner(user_id, completed_at)')
    .eq('daily_workouts.user_id', userId)
    .not('daily_workouts.completed_at', 'is', null)

  const allExecutedExerciseIds = new Set(
    (allExecutedItems ?? []).map((i: any) => i.skill_exercise_id)
  )

  const toUnlock: string[] = []

  for (const a of allAchievements) {
    if (unlockedIds.has(a.id)) continue

    switch (a.type) {
      case 'session_count':
        if (totalWorkouts >= (a.threshold ?? 0)) {
          toUnlock.push(a.id)
        }
        break

      case 'skill_exercise':
        // Desbloqueia se este exercício foi executado em qualquer treino concluído
        if (a.skill_exercise_id && allExecutedExerciseIds.has(a.skill_exercise_id)) {
          toUnlock.push(a.id)
        }
        break

      case 'skill_level':
        // Desbloqueia se houve avanço para o nível alvo nesta skill hoje
        if (
          latestLevelUp &&
          a.skill_id === skillId &&
          a.target_level === latestLevelUp.to_level
        ) {
          toUnlock.push(a.id)
        }
        break
    }
  }

  if (toUnlock.length === 0) return []

  await supabase
    .from('user_achievements')
    .upsert(
      toUnlock.map(achievement_id => ({
        user_id: userId,
        achievement_id,
        unlocked_at: new Date().toISOString(),
        shared: false,
      })),
      { onConflict: 'user_id,achievement_id' }
    )

  return toUnlock
}
