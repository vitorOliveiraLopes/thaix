import { SupabaseClient } from '@supabase/supabase-js'

export async function evaluateAchievements(
  supabase: SupabaseClient,
  userId: string,
  completedSessionId: string
) {
  // Busca todas as conquistas e as já desbloqueadas
  const [achievementsRes, unlockedRes, workoutsRes, sessionItemsRes] = await Promise.all([
    supabase.from('achievements').select('*'),
    supabase.from('user_achievements').select('achievement_id').eq('user_id', userId),
    supabase.from('workouts_completed').select('id').eq('user_id', userId),
    supabase.from('session_items').select('exercise_id').eq('session_id', completedSessionId),
  ])

  const allAchievements = achievementsRes.data ?? []
  const unlockedIds = new Set((unlockedRes.data ?? []).map(u => u.achievement_id))
  const totalWorkouts = (workoutsRes.data ?? []).length
  const sessionExerciseIds = new Set((sessionItemsRes.data ?? []).map(i => i.exercise_id))

  const toUnlock: string[] = []

  for (const achievement of allAchievements) {
    if (unlockedIds.has(achievement.id)) continue

    if (achievement.type === 'session_count') {
      if (totalWorkouts >= (achievement.threshold ?? 0)) {
        toUnlock.push(achievement.id)
      }
    }

    if (achievement.type === 'exercise') {
      if (achievement.exercise_id && sessionExerciseIds.has(achievement.exercise_id)) {
        toUnlock.push(achievement.id)
      }
    }
  }

  if (toUnlock.length === 0) return []

  const inserts = toUnlock.map(achievement_id => ({
    user_id: userId,
    achievement_id,
    unlocked_at: new Date().toISOString(),
    shared: false,
  }))

  await supabase
    .from('user_achievements')
    .upsert(inserts, { onConflict: 'user_id,achievement_id' })

  return toUnlock
}