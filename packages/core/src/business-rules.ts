/**
 * ThaixSkill — Regras de negócio puras
 *
 * Funções sem I/O (sem Supabase, sem fetch) usadas por
 * apps/api (route de conclusão), pelo gerador em ./generator.ts e pelo app.
 * Testadas isoladamente em ./__tests__/business-rules.test.ts.
 */

// ─── Onboarding: score e protocolo recomendado ───────────────────────────────

export type Protocol = 'iniciante' | 'intermediario' | 'avancado'

export function calculateOnboardingScore(pushups: number, pullups: number, squats: number): number {
  return pushups + pullups * 2 + squats / 2
}

export function recommendProtocol(pushups: number, pullups: number, squats: number): Protocol {
  const score = calculateOnboardingScore(pushups, pullups, squats)

  if (pushups >= 20 && pullups >= 5) return 'avancado'
  if (pullups === 0 && score < 8) return 'iniciante'
  if (pullups === 0) return 'intermediario'
  if (score < 10) return 'iniciante'
  if (score < 25) return 'intermediario'
  return 'avancado'
}

// ─── Geração de treino: composição e seleção sem repetição ──────────────────

export const EXERCISE_COUNT: Record<Protocol, number> = {
  iniciante: 5,
  intermediario: 6,
  avancado: 4,
}

// [core, forca, mobilidade, skill]
export const WORKOUT_COMPOSITION: Record<Protocol, [number, number, number, number]> = {
  iniciante: [2, 1, 0, 2],
  intermediario: [2, 2, 0, 2],
  avancado: [1, 1, 0, 2],
}

/**
 * Seleciona até `n` itens de um pool, nunca repetindo e nunca
 * excedendo o tamanho real do pool disponível.
 */
export function takeWithoutRepeat<T>(pool: T[], n: number): T[] {
  return pool.slice(0, Math.min(n, pool.length))
}

export type ExercisePoolByCategory<T> = {
  core: T[]
  forca: T[]
  mobilidade: T[]
  skill: T[]
}

/**
 * Monta a lista final de exercícios de um treino a partir do pool
 * disponível por categoria, respeitando a composição do nível e
 * nunca repetindo um exercício quando o pool é menor que o pedido.
 */
export function buildWorkoutSelection<T>(
  pool: ExercisePoolByCategory<T>,
  level: Protocol
): T[] {
  const [coreCount, forcaCount, mobilidadeCount, skillCount] = WORKOUT_COMPOSITION[level]
  const totalCount = EXERCISE_COUNT[level]

  const selected: T[] = [
    ...takeWithoutRepeat(pool.core, coreCount),
    ...takeWithoutRepeat(pool.forca, forcaCount),
    ...(mobilidadeCount > 0 ? takeWithoutRepeat(pool.mobilidade, mobilidadeCount) : []),
    ...takeWithoutRepeat(pool.skill, skillCount),
  ]

  return selected.slice(0, totalCount)
}

// ─── Progressão de nível ──────────────────────────────────────────────────────

export type ExerciseGoal = {
  skill_exercise_id: string
  reps?: number | null
  time_sec?: number | null
}

export type ExerciseResult = {
  skill_exercise_id: string
  reps_achieved?: number | null
  time_achieved_sec?: number | null
  perceived_effort: number
}

/** Verifica se um resultado bateu a meta do exercício (reps OU tempo). */
export function metGoal(goal: ExerciseGoal, result: ExerciseResult): boolean {
  if (goal.reps) return (result.reps_achieved ?? 0) >= goal.reps
  if (goal.time_sec) return (result.time_achieved_sec ?? 0) >= goal.time_sec
  return false
}

/** Verifica se TODOS os resultados de uma sessão bateram a meta. */
export function sessionMetAllGoals(goals: ExerciseGoal[], results: ExerciseResult[]): boolean {
  if (goals.length === 0 || results.length === 0) return false
  return results.every(r => {
    const goal = goals.find(g => g.skill_exercise_id === r.skill_exercise_id)
    return goal ? metGoal(goal, r) : false
  })
}

export function averageEffort(results: ExerciseResult[]): number {
  if (results.length === 0) return 0
  return results.reduce((sum, r) => sum + (r.perceived_effort ?? 3), 0) / results.length
}

const PROGRESSION_EFFORT_THRESHOLD = 2.5

/**
 * Critério de progressão: as últimas 2 sessões devem ter batido a meta
 * em TODOS os exercícios, com esforço médio ≤ 2.5 (indicando que o
 * nível atual não é mais desafiador o suficiente).
 */
export function shouldProgressLevel(params: {
  currentLevel: Protocol
  sessionsAllMetGoal: boolean[] // uma entrada por sessão avaliada (mín. 2)
  results: ExerciseResult[]     // resultados agregados das sessões avaliadas
}): boolean {
  const { currentLevel, sessionsAllMetGoal, results } = params

  if (currentLevel === 'avancado') return false
  if (sessionsAllMetGoal.length < 2) return false
  if (!sessionsAllMetGoal.every(Boolean)) return false

  return averageEffort(results) <= PROGRESSION_EFFORT_THRESHOLD
}

export function nextLevel(current: Protocol): Protocol {
  if (current === 'iniciante') return 'intermediario'
  if (current === 'intermediario') return 'avancado'
  return 'avancado'
}

// ─── Conquistas ───────────────────────────────────────────────────────────────

export type AchievementRule = {
  id: string
  type: 'session_count' | 'skill_exercise' | 'skill_level'
  threshold?: number | null
  skill_exercise_id?: string | null
  skill_id?: string | null
  target_level?: string | null
}

export type AchievementContext = {
  totalWorkoutsCompleted: number
  executedExerciseIds: Set<string>
  latestLevelUp: { skillId: string; toLevel: string } | null
  alreadyUnlockedIds: Set<string>
}

/** Decide quais conquistas devem ser desbloqueadas dado o contexto atual do aluno. */
export function evaluateAchievements(
  rules: AchievementRule[],
  ctx: AchievementContext
): string[] {
  const toUnlock: string[] = []

  for (const rule of rules) {
    if (ctx.alreadyUnlockedIds.has(rule.id)) continue

    switch (rule.type) {
      case 'session_count':
        if (ctx.totalWorkoutsCompleted >= (rule.threshold ?? 0)) toUnlock.push(rule.id)
        break

      case 'skill_exercise':
        if (rule.skill_exercise_id && ctx.executedExerciseIds.has(rule.skill_exercise_id)) {
          toUnlock.push(rule.id)
        }
        break

      case 'skill_level':
        if (
          ctx.latestLevelUp &&
          rule.skill_id === ctx.latestLevelUp.skillId &&
          rule.target_level === ctx.latestLevelUp.toLevel
        ) {
          toUnlock.push(rule.id)
        }
        break
    }
  }

  return toUnlock
}

// ─── PRs automáticos ────────────────────────────────────────────────────────

export type PREntry = { exerciseId: string; value: number; unit: 'reps' | 'seconds' }

/**
 * Dado o histórico de PRs existentes e os resultados de um treino recém
 * concluído, retorna apenas os novos recordes (valor estritamente maior
 * que o melhor registrado até então para aquele exercício/unidade).
 */
export function detectNewPRs(
  existingBests: PREntry[],
  results: ExerciseResult[]
): PREntry[] {
  const bestMap = new Map<string, number>()
  for (const pr of existingBests) {
    const key = `${pr.exerciseId}|${pr.unit}`
    const cur = bestMap.get(key)
    if (cur === undefined || pr.value > cur) bestMap.set(key, pr.value)
  }

  const newPRs: PREntry[] = []

  for (const r of results) {
    if ((r.reps_achieved ?? 0) > 0) {
      const key = `${r.skill_exercise_id}|reps`
      if ((bestMap.get(key) ?? -1) < r.reps_achieved!) {
        newPRs.push({ exerciseId: r.skill_exercise_id, value: r.reps_achieved!, unit: 'reps' })
      }
    }
    if ((r.time_achieved_sec ?? 0) > 0) {
      const key = `${r.skill_exercise_id}|seconds`
      if ((bestMap.get(key) ?? -1) < r.time_achieved_sec!) {
        newPRs.push({ exerciseId: r.skill_exercise_id, value: r.time_achieved_sec!, unit: 'seconds' })
      }
    }
  }

  return newPRs
}

// ─── Streak ─────────────────────────────────────────────────────────────────

/** Calcula a sequência atual de dias consecutivos treinados, a partir de datas ISO (YYYY-MM-DD). */
export function calculateStreak(workoutDates: string[], todayISO: string): number {
  if (workoutDates.length === 0) return 0

  const days = [...new Set(workoutDates)].sort().reverse()
  const today = new Date(todayISO)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayISO = yesterday.toISOString().split('T')[0]

  if (days[0] !== todayISO && days[0] !== yesterdayISO) return 0

  let streak = 1
  for (let i = 1; i < days.length; i++) {
    const diff = (new Date(days[i - 1]).getTime() - new Date(days[i]).getTime()) / 86_400_000
    if (diff === 1) streak++
    else break
  }
  return streak
}

// ─── Múltiplas séries por exercício ──────────────────────────────────────────

/**
 * Retorna o melhor valor entre as séries realizadas (usado para PR e para
 * o valor "resumo" de reps_achieved/time_achieved_sec). Ignora nulos.
 */
export function bestOfSets(values: (number | null | undefined)[]): number {
  const valid = values.filter((v): v is number => v !== null && v !== undefined)
  return valid.length > 0 ? Math.max(...valid) : 0
}

/**
 * Quantas séries, dentre as realizadas, bateram a meta (reps OU tempo).
 */
export function countSetsMetGoal(
  goal: { reps?: number | null; time_sec?: number | null },
  achieved: (number | null | undefined)[]
): number {
  return achieved.filter(v => {
    if (v === null || v === undefined) return false
    if (goal.reps)     return v >= goal.reps
    if (goal.time_sec) return v >= goal.time_sec
    return false
  }).length
}

/**
 * Fração mínima de séries que precisam bater a meta para o exercício contar
 * como "sucesso" na progressão de nível. Regra: 2 de 3 séries (arredondado
 * para 2/3 do total em exercícios com número diferente de séries).
 * Ex: 3 séries → precisa de 2. 2 séries → precisa das 2. 1 série → precisa de 1.
 */
export function setsRequiredToPass(totalSets: number): number {
  return Math.max(1, Math.ceil((totalSets * 2) / 3))
}

/**
 * Verifica se um exercício com múltiplas séries "bateu a meta" no sentido
 * flexível aprovado para progressão: pelo menos setsRequiredToPass(totalSets)
 * séries precisam ter atingido reps/tempo alvo.
 */
export function exerciseMetGoalMultiSet(
  goal: { reps?: number | null; time_sec?: number | null },
  achieved: (number | null | undefined)[],
  totalSets: number
): boolean {
  const passed = countSetsMetGoal(goal, achieved)
  return passed >= setsRequiredToPass(totalSets)
}

export type MultiSetExerciseGoal = {
  skill_exercise_id: string
  sets: number
  reps?: number | null
  time_sec?: number | null
}

export type MultiSetExerciseResult = {
  skill_exercise_id: string
  reps_per_set?: (number | null)[]
  time_per_set?: (number | null)[]
  perceived_effort: number
}

/**
 * Versão multi-série de sessionMetAllGoals: verifica se TODOS os
 * exercícios da sessão bateram a meta (usando o critério de 2/3 séries
 * por exercício, via exerciseMetGoalMultiSet).
 */
export function sessionMetAllGoalsMultiSet(
  goals: MultiSetExerciseGoal[],
  results: MultiSetExerciseResult[]
): boolean {
  if (goals.length === 0 || results.length === 0) return false

  return results.every(r => {
    const goal = goals.find(g => g.skill_exercise_id === r.skill_exercise_id)
    if (!goal) return false

    const achieved = goal.time_sec
      ? (r.time_per_set ?? [])
      : (r.reps_per_set ?? [])

    return exerciseMetGoalMultiSet(goal, achieved, goal.sets)
  })
}
