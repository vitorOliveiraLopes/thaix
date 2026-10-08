import { createClient } from '@/lib/supabase/client'

import {
  selectSkillsForToday,
  buildAdaptiveProfile,
  selectExercisesFromPool,
  workoutSeed,
  type SkillExercise,
  type HistoryResult,
  type HistoryItem,
} from '@thaix/core'

// As decisões (skills do dia, perfil adaptativo, seleção e progressão) vivem
// em @thaix/core. Este arquivo só busca dados no Supabase e grava o resultado.

type UserSkillProgress = {
  skill_id: string
  level: string
  week_number: number
  sessions_at_current_level: number
}

type DailyWorkoutItem = {
  skill_exercise_id: string
  order_index: number
  sets: number
  reps: number | null
  time_sec: number | null
  exercise: SkillExercise
}

type GeneratedWorkout = {
  id: string
  skill_id: string
  date: string
  week_number: number
  completed_at: string | null
  items: DailyWorkoutItem[]
}

type SupabaseClient = ReturnType<typeof createClient>

/** Busca o histórico recente da skill para montar o perfil adaptativo. */
async function fetchAdaptiveHistory(supabase: SupabaseClient, userId: string, skillId: string) {
  const { data: recentWorkouts } = await supabase
    .from('daily_workouts')
    .select('id, date')
    .eq('user_id', userId)
    .eq('skill_id', skillId)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })
    .limit(3)

  const workoutIds = ((recentWorkouts ?? []) as any[]).map(w => w.id as string)
  const previousId = workoutIds[1]

  const [resultsRes, previousItemsRes] = await Promise.all([
    workoutIds.length > 0
      ? supabase
          .from('daily_workout_results')
          .select('daily_workout_id, skill_exercise_id, reps_achieved, time_achieved_sec, perceived_effort')
          .in('daily_workout_id', workoutIds)
      : Promise.resolve({ data: [] }),
    previousId
      ? supabase
          .from('daily_workout_items')
          .select('skill_exercise_id, skill_exercises(category)')
          .eq('daily_workout_id', previousId)
      : Promise.resolve({ data: [] }),
  ])

  const results = (resultsRes.data ?? []) as HistoryResult[]
  const previousItems: HistoryItem[] = ((previousItemsRes.data ?? []) as any[]).map(i => ({
    skill_exercise_id: i.skill_exercise_id,
    category: i.skill_exercises?.category ?? null,
  }))

  return buildAdaptiveProfile(workoutIds, results, previousItems)
}

async function selectExercises(
  supabase: SupabaseClient,
  userId: string,
  skillId: string,
  level: string,
  weekNumber: number
): Promise<SkillExercise[]> {
  const { data: exercises } = await supabase
    .from('skill_exercises')
    .select('*')
    .eq('skill_id', skillId)
    .eq('level', level)
    .order('order_index')

  if (!exercises || exercises.length === 0) return []

  const profile = await fetchAdaptiveHistory(supabase, userId, skillId)
  const today = new Date().toISOString().split('T')[0]

  return selectExercisesFromPool({
    pool: exercises as SkillExercise[],
    level,
    weekNumber,
    seed: workoutSeed(userId, today, weekNumber),
    profile,
  })
}

// ── Função principal: gerar treino do dia ────────────────────────────
export async function generateDailyWorkouts(userId: string): Promise<GeneratedWorkout[]> {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  // 1. Buscar progresso do aluno por skill
  const skillProgress = (await supabase
  .from('user_skill_progress')
  .select('skill_id, level, week_number, sessions_at_current_level')
  .eq('user_id', userId)).data as UserSkillProgress[] | null

  if (!skillProgress || skillProgress.length === 0) return []

  // 2. Verificar dias de treino do aluno
  const { data: settings } = await supabase
    .from('user_settings')
    .select('notifications')
    .eq('user_id', userId)
    .single()

  // Dia da semana atual (0=Dom, 1=Seg, etc.)
  const todayDayOfWeek = new Date().getDay()

  // 3. Verificar se treinos já foram gerados hoje
  const { data: existingWorkouts } = await supabase
    .from('daily_workouts')
    .select('id, skill_id, date, week_number, completed_at, daily_workout_items(*, skill_exercises(*))')
    .eq('user_id', userId)
    .eq('date', today)

  if (existingWorkouts && existingWorkouts.length > 0) {
    // Já gerado — retornar os existentes
    return existingWorkouts.map((w: any) => ({
      id: w.id,
      skill_id: w.skill_id,
      date: w.date,
      week_number: w.week_number,
      completed_at: w.completed_at ?? null,
      items: w.daily_workout_items.map((item: any) => ({
        skill_exercise_id: item.skill_exercise_id,
        order_index: item.order_index,
        sets: item.sets,
        reps: item.reps,
        time_sec: item.time_sec,
        exercise: item.skill_exercises,
      })),
    }))
  }

  // 4. Selecionar skills para hoje
  const allSkillIds = skillProgress.map(p => p.skill_id)
  const skillsForToday = selectSkillsForToday(allSkillIds, todayDayOfWeek)

  const generated: GeneratedWorkout[] = []

  // 5. Gerar treino para cada skill selecionada
  for (const skillId of skillsForToday) {
    const progress = skillProgress.find(p => p.skill_id === skillId)
    if (!progress) continue

    // A progressão de nível acontece em /api/workouts/complete/route.ts
    // logo após o aluno concluir um treino — não precisa ser reavaliada
    // aqui na geração, o progress já reflete o estado atual.
    const level = progress.level
    const weekNumber = progress.week_number

    // Selecionar exercícios
    const exercises = await selectExercises(
      supabase, userId, skillId, level, weekNumber
    )

    if (exercises.length === 0) continue

    // Garantir idempotência: tentar inserir, ignorar conflito, depois buscar a linha.
    // Isso protege contra chamadas paralelas (ex: React Strict Mode) sem depender
    // do retorno do upsert, que é null quando ignoreDuplicates:true.
    await supabase
      .from('daily_workouts')
      .upsert(
        {
          user_id:     userId,
          skill_id:    skillId,
          date:        today,
          week_number: weekNumber,
        },
        { onConflict: 'user_id,skill_id,date', ignoreDuplicates: true }
      )

    // Buscar a linha garantidamente existente após o upsert
    const { data: workout, error: workoutError } = await supabase
      .from('daily_workouts')
      .select('id')
      .eq('user_id', userId)
      .eq('skill_id', skillId)
      .eq('date', today)
      .single()

    if (workoutError || !workout) continue

    // Inserir itens
    const items = exercises.map((e, i) => ({
      daily_workout_id: workout.id,
      skill_exercise_id: e.id,
      order_index: i + 1,
      sets: e.sets,
      reps: e.reps,
      time_sec: e.time_sec,
    }))

    await supabase.from('daily_workout_items').insert(items)

    generated.push({
      id: workout.id,
      skill_id: skillId,
      date: today,
      week_number: weekNumber,
      completed_at: null,
      items: exercises.map((e, i) => ({
        skill_exercise_id: e.id,
        order_index: i + 1,
        sets: e.sets,
        reps: e.reps,
        time_sec: e.time_sec,
        exercise: e,
      })),
    })
  }

  return generated
}

// ── Clonar treino existente para hoje (funcionalidade "Refazer") ─────────────
//
// Cria um novo daily_workout com a data de hoje copiando todos os itens do
// treino original. O registro original (e seus resultados) fica intacto no
// histórico. Ao concluir o treino clonado, a API de conclusão é chamada
// normalmente pela API (/api/workouts/complete) — incluindo o incremento de sessions_at_current_level, já que
// o esforço realizado é real independentemente de ser uma repetição.
//
// Retorna o ID do novo workout criado.
export async function cloneWorkout(
  userId: string,
  originalWorkoutId: string
): Promise<string | null> {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  // 1. Buscar o treino original com seus itens
  const { data: original, error: origError } = await supabase
    .from('daily_workouts')
    .select(`
      skill_id, week_number,
      daily_workout_items (
        skill_exercise_id, order_index, sets, reps, time_sec
      )
    `)
    .eq('id', originalWorkoutId)
    .eq('user_id', userId)
    .single()

  if (origError || !original) return null

  // 2. Verificar se já existe um clone deste treino hoje para não duplicar
  const { data: existingToday } = await supabase
    .from('daily_workouts')
    .select('id')
    .eq('user_id', userId)
    .eq('skill_id', original.skill_id)
    .eq('date', today)
    .maybeSingle()

  if (existingToday) return existingToday.id

  // 3. Criar o novo daily_workout para hoje
  const { data: cloned, error: cloneError } = await supabase
    .from('daily_workouts')
    .insert({
      user_id: userId,
      skill_id: original.skill_id,
      date: today,
      week_number: original.week_number,
    })
    .select('id')
    .single()

  if (cloneError || !cloned) return null

  // 4. Copiar os itens do treino original para o clone
  const items = (original.daily_workout_items as any[]).map(item => ({
    daily_workout_id: cloned.id,
    skill_exercise_id: item.skill_exercise_id,
    order_index: item.order_index,
    sets: item.sets,
    reps: item.reps,
    time_sec: item.time_sec,
  }))

  const { error: itemsError } = await supabase
    .from('daily_workout_items')
    .insert(items)

  if (itemsError) {
    // Rollback: remover o workout clonado se os itens falharam
    await supabase.from('daily_workouts').delete().eq('id', cloned.id)
    return null
  }

  return cloned.id
}

export type { GeneratedWorkout, DailyWorkoutItem, SkillExercise }