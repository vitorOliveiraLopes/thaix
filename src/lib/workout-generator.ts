import { createClient } from '@/lib/supabase/client'

// ── Grupos de sobreposição muscular ──────────────────────────────────
const MUSCLE_GROUPS: Record<string, string> = {
  'pull-up': 'A', // puxada
  'c2b':     'A', // puxada
  'bmu':     'A', // puxada
  'hspu':    'B', // empurrada invertida
  't2b':     'C', // core/quadril
}

// T2B combina com qualquer grupo
// HSPU não combina com Grupo A
// Grupo A nunca repete no mesmo dia
const INCOMPATIBLE: Record<string, string[]> = {
  'pull-up': ['c2b', 'bmu'],
  'c2b':     ['pull-up', 'bmu'],
  'bmu':     ['pull-up', 'c2b'],
  'hspu':    ['pull-up', 'c2b', 'bmu'],
}

// ── Número de exercícios por nível ───────────────────────────────────
const EXERCISE_COUNT: Record<string, number> = {
  iniciante:     5,
  intermediario: 6,
  avancado:      4,  // atualizar quando mais exercícios forem cadastrados
}

// ── Composição do treino por nível ───────────────────────────────────
// [core, forca, mobilidade, skill]
// Composição baseada no que existe no banco por nível.
// Avançado limitado até mais exercícios serem cadastrados com a Coach Thaix.
const WORKOUT_COMPOSITION: Record<string, number[]> = {
  iniciante:     [2, 1, 0, 2],   // 5 total (3 core disponíveis, 5 forca, 1 skill)
  intermediario: [2, 2, 0, 2],   // 6 total (2 core, 4 forca, 2 skill)
  avancado:      [1, 1, 0, 2],   // 4 total — reflete o banco atual (1c, 1f, 2s)
}

type SkillExercise = {
  id: string
  skill_id: string
  exercise_name: string
  category: string
  level: string
  sets: number
  reps: number | null
  time_sec: number | null
  rest_sec: number
  note: string | null
  order_index: number
}

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

// ── Selecionar skills para hoje ───────────────────────────────────────
// Máximo 2 skills por dia, respeitando sobreposição muscular
function selectSkillsForToday(
  allSkills: string[],
  dayIndex: number // índice do dia na semana (0-6)
): string[] {
  if (allSkills.length <= 2) return allSkills

  // Separar por grupo muscular
  const groupA = allSkills.filter(s => MUSCLE_GROUPS[s] === 'A')
  const groupB = allSkills.filter(s => MUSCLE_GROUPS[s] === 'B')
  const groupC = allSkills.filter(s => MUSCLE_GROUPS[s] === 'C')

  const selected: string[] = []

  // Rotacionar grupo A (pull-up, c2b, bmu) — um por vez
  if (groupA.length > 0) {
    selected.push(groupA[dayIndex % groupA.length])
  }

  // Adicionar T2B ou HSPU se couber (máx 2 skills/dia)
  // HSPU não vai com Grupo A
  if (selected.length < 2) {
    if (groupC.length > 0) {
      selected.push(groupC[dayIndex % groupC.length])
    } else if (groupB.length > 0 && !selected.some(s => MUSCLE_GROUPS[s] === 'A')) {
      selected.push(groupB[0])
    }
  }

  // Se não tem Grupo A, pode combinar B e C
  if (selected.length === 0) {
    if (groupB.length > 0) selected.push(groupB[0])
    if (groupC.length > 0 && selected.length < 2) selected.push(groupC[0])
  }

  return selected.slice(0, 2)
}
// ── Perfil adaptativo do aluno ────────────────────────────────────────────────
//
// Construído a partir dos dados já coletados nas últimas N sessões.
// Usado por selectExercises para personalizar a seleção de exercícios.

type AdaptiveProfile = {
  // IDs de exercícios onde o aluno bateu a meta nas últimas 2 sessões
  // → candidatos a variações mais difíceis / maior destaque
  consistentlyMet: Set<string>

  // IDs de exercícios onde o aluno teve esforço ≥ 4 nas últimas 2 sessões
  // → dar descanso, evitar repetir este exercício específico
  highEffortExercises: Set<string>

  // Esforço médio das últimas 3 sessões (para alertas de recuperação)
  recentAvgEffort: number

  // IDs de exercícios de força usados ontem (rotação muscular)
  usedForcaYesterday: Set<string>
}

async function buildAdaptiveProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  skillId: string
): Promise<AdaptiveProfile> {
  // Buscar as últimas 3 sessões concluídas desta skill
  const { data: recentWorkouts } = await supabase
    .from('daily_workouts')
    .select('id, date')
    .eq('user_id', userId)
    .eq('skill_id', skillId)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })
    .limit(3)

  const workoutIds = (recentWorkouts ?? []).map((w: any) => w.id)
  const yesterdayId = (recentWorkouts ?? [])[1]?.id

  const [resultsRes, yesterdayItemsRes] = await Promise.all([
    workoutIds.length > 0
      ? supabase
          .from('daily_workout_results')
          .select('daily_workout_id, skill_exercise_id, reps_achieved, time_achieved_sec, perceived_effort')
          .in('daily_workout_id', workoutIds)
      : Promise.resolve({ data: [] }),
    yesterdayId
      ? supabase
          .from('daily_workout_items')
          .select('skill_exercise_id, skill_exercises(category)')
          .eq('daily_workout_id', yesterdayId)
      : Promise.resolve({ data: [] }),
  ])

  const allResults = (resultsRes.data ?? []) as any[]

  // ── Exercícios com meta batida nas últimas 2 sessões ──────────────────────
  const last2Ids = workoutIds.slice(0, 2)
  const resultsByWorkout = new Map<string, any[]>()
  for (const r of allResults) {
    if (!resultsByWorkout.has(r.daily_workout_id)) resultsByWorkout.set(r.daily_workout_id, [])
    resultsByWorkout.get(r.daily_workout_id)!.push(r)
  }

  const consistentlyMet = new Set<string>()
  if (last2Ids.length === 2) {
    const w1 = resultsByWorkout.get(last2Ids[0]) ?? []
    const w2 = resultsByWorkout.get(last2Ids[1]) ?? []
    for (const r1 of w1) {
      const r2 = w2.find((r: any) => r.skill_exercise_id === r1.skill_exercise_id)
      if (!r2) continue
      const metW1 = (r1.reps_achieved ?? 0) > 0 || (r1.time_achieved_sec ?? 0) > 0
      const metW2 = (r2.reps_achieved ?? 0) > 0 || (r2.time_achieved_sec ?? 0) > 0
      if (metW1 && metW2) consistentlyMet.add(r1.skill_exercise_id)
    }
  }

  // ── Exercícios com esforço alto nas últimas 2 sessões ────────────────────
  const highEffortExercises = new Set<string>()
  const exerciseEfforts = new Map<string, number[]>()
  for (const r of allResults.filter((r: any) => last2Ids.includes(r.daily_workout_id))) {
    if (!exerciseEfforts.has(r.skill_exercise_id)) exerciseEfforts.set(r.skill_exercise_id, [])
    exerciseEfforts.get(r.skill_exercise_id)!.push(r.perceived_effort ?? 3)
  }
  for (const [exId, efforts] of exerciseEfforts) {
    const avg = efforts.reduce((a: number, b: number) => a + b, 0) / efforts.length
    if (avg >= 4) highEffortExercises.add(exId)
  }

  // ── Esforço médio recente (últimas 3 sessões) ─────────────────────────────
  const efforts = allResults.map((r: any) => r.perceived_effort ?? 3)
  const recentAvgEffort = efforts.length > 0
    ? efforts.reduce((a: number, b: number) => a + b, 0) / efforts.length
    : 3

  // ── Exercícios de força usados ontem ─────────────────────────────────────
  const usedForcaYesterday = new Set<string>(
    (yesterdayItemsRes.data ?? [])
      .filter((i: any) => i.skill_exercises?.category === 'forca')
      .map((i: any) => i.skill_exercise_id)
  )

  return { consistentlyMet, highEffortExercises, recentAvgEffort, usedForcaYesterday }
}

async function selectExercises(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  skillId: string,
  level: string,
  weekNumber: number
): Promise<SkillExercise[]> {
  const composition = WORKOUT_COMPOSITION[level] ?? WORKOUT_COMPOSITION.iniciante
  const totalCount = EXERCISE_COUNT[level] ?? 5
  const [coreCount, forcaCount, mobilidadeCount, skillCount] = composition

  const { data: exercises } = await supabase
    .from('skill_exercises')
    .select('*')
    .eq('skill_id', skillId)
    .eq('level', level)
    .order('order_index')

  if (!exercises || exercises.length === 0) return []

  // Construir perfil adaptativo a partir do histórico real do aluno
  const profile = await buildAdaptiveProfile(supabase, userId, skillId)

  // ── Seed por usuário × dia × semana ──────────────────────────────────────
  // Inclui userId para que alunos no mesmo nível recebam ordens diferentes,
  // tornando o treino único por pessoa mesmo com o mesmo pool de exercícios.
  const today = new Date().toISOString().split('T')[0]
  const userSeedBase = userId.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)
  const seed = parseInt(today.replace(/-/g, '')) + weekNumber + userSeedBase

  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = (seed * (i + 7)) % (i + 1)
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  // ── Pontuação adaptativa ──────────────────────────────────────────────────
  // Determina a prioridade de cada exercício na seleção.
  //   +2  aluno bate meta consistentemente (pronto, consolidar o padrão)
  //   -3  esforço alto recente (precisa de descanso deste movimento)
  //   -2  força usada ontem (rotação muscular)
  const scoreExercise = (ex: any): number => {
    let score = 0
    if (profile.consistentlyMet.has(ex.id)) score += 2
    if (profile.highEffortExercises.has(ex.id)) score -= 3
    if (ex.category === 'forca' && profile.usedForcaYesterday.has(ex.id)) score -= 2
    return score
  }

  const prioritize = (arr: any[]) =>
    shuffle(arr).sort((a: any, b: any) => scoreExercise(b) - scoreExercise(a))

  const byCategory = {
    core:       prioritize(exercises.filter((e: any) => e.category === 'core')),
    forca:      prioritize(exercises.filter((e: any) => e.category === 'forca')),
    mobilidade: prioritize(exercises.filter((e: any) => e.category === 'mobilidade')),
    skill:      prioritize(exercises.filter((e: any) => e.category === 'skill')),
  }

  const selected: SkillExercise[] = []
  // Usar Math.min para nunca pedir mais exercícios do que o pool tem.
  // Isso evita repetições quando o banco está incompleto para um nível.
  const take = (arr: any[], n: number) => arr.slice(0, Math.min(n, arr.length))

  selected.push(...take(byCategory.core,       coreCount))
  selected.push(...take(byCategory.forca,      forcaCount))
  if (mobilidadeCount > 0) selected.push(...take(byCategory.mobilidade, mobilidadeCount))
  selected.push(...take(byCategory.skill,      skillCount))

  return selected.slice(0, totalCount).map((e: any) => ({
    ...e,
    sets:     adjustSets(e.sets, weekNumber),
    reps:     e.reps     ? adjustReps(e.reps, weekNumber, level)  : null,
    time_sec: e.time_sec ? adjustTime(e.time_sec, weekNumber)     : null,
  }))
}


// ── Ajustes progressivos por semana ──────────────────────────────────
function adjustSets(baseSets: number, week: number): number {
  if (week >= 7) return Math.min(baseSets + 1, 5)
  if (week >= 5) return baseSets
  return baseSets
}

function adjustReps(baseReps: number, week: number, level: string): number {
  const increment = week <= 2 ? 0 : week <= 4 ? 1 : week <= 6 ? 2 : 3
  const max = level === 'avancado' ? 15 : level === 'intermediario' ? 12 : 10
  return Math.min(baseReps + increment, max)
}

function adjustTime(baseSec: number, week: number): number {
  const increment = week <= 2 ? 0 : week <= 4 ? 5 : week <= 6 ? 10 : 15
  return baseSec + increment
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

// ── Concluir treino e salvar resultados ──────────────────────────────
export async function completeWorkout(
  userId: string,
  workoutId: string,
  skillId: string,
  results: {
    skill_exercise_id: string
    reps_achieved?: number
    time_achieved_sec?: number
    perceived_effort: number
  }[]
): Promise<void> {
  const supabase = createClient()

  // Salvar resultados
  const resultInserts = results.map(r => ({
    daily_workout_id: workoutId,
    skill_exercise_id: r.skill_exercise_id,
    completed: true,
    reps_achieved: r.reps_achieved ?? null,
    time_achieved_sec: r.time_achieved_sec ?? null,
    perceived_effort: r.perceived_effort,
    completed_at: new Date().toISOString(),
  }))

  await supabase
    .from('daily_workout_results')
    .upsert(resultInserts, { onConflict: 'daily_workout_id,skill_exercise_id' })

  // Marcar treino como concluído
  await supabase
    .from('daily_workouts')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', workoutId)

  // Incrementar sessões no nível atual
  const { data: current } = await supabase
    .from('user_skill_progress')
    .select('sessions_at_current_level')
    .eq('user_id', userId)
    .eq('skill_id', skillId)
    .single()

  await supabase
    .from('user_skill_progress')
    .update({
      sessions_at_current_level: (current?.sessions_at_current_level ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('skill_id', skillId)
}

// ── Clonar treino existente para hoje (funcionalidade "Refazer") ─────────────
//
// Cria um novo daily_workout com a data de hoje copiando todos os itens do
// treino original. O registro original (e seus resultados) fica intacto no
// histórico. Ao concluir o treino clonado, completeWorkout é chamado
// normalmente — incluindo o incremento de sessions_at_current_level, já que
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