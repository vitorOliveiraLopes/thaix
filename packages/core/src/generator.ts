/**
 * ThaixSkill — Gerador de treino (parte pura)
 *
 * Toda a decisão de "quais skills hoje" e "quais exercícios, com quantas
 * séries/reps" vive aqui, sem Supabase. Quem chama (API hoje, ferramentas
 * do agente depois) busca os dados, passa para estas funções e grava o
 * resultado. Comportamento idêntico ao src/lib/workout-generator.ts original.
 */

import { buildWorkoutSelection, type Protocol } from './business-rules'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ExerciseCategory = 'core' | 'forca' | 'mobilidade' | 'skill'

export type SkillExercise = {
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
  /** Equipamentos necessários (ids de EQUIPMENT_OPTIONS). Vazio = nenhum. */
  equipment?: string[] | null
}

/** Resultado de um exercício numa sessão concluída (linha de daily_workout_results). */
export type HistoryResult = {
  daily_workout_id: string
  skill_exercise_id: string
  reps_achieved: number | null
  time_achieved_sec: number | null
  perceived_effort: number | null
}

/** Item de um treino anterior, com a categoria do exercício. */
export type HistoryItem = {
  skill_exercise_id: string
  category: string | null
}

export type AdaptiveProfile = {
  /** Meta batida nas duas últimas sessões → consolidar o padrão. */
  consistentlyMet: Set<string>
  /** Esforço médio ≥ 4 nas duas últimas sessões → dar descanso ao movimento. */
  highEffortExercises: Set<string>
  /** Esforço médio das últimas 3 sessões. */
  recentAvgEffort: number
  /** Exercícios de força usados na sessão anterior → rotação muscular. */
  usedForcaYesterday: Set<string>
}

// ─── Seleção de skills do dia ─────────────────────────────────────────────────

/** A = puxada, B = empurrada invertida, C = core/quadril. */
export const MUSCLE_GROUPS: Record<string, 'A' | 'B' | 'C'> = {
  'pull-up': 'A',
  'c2b': 'A',
  'bmu': 'A',
  'hspu': 'B',
  't2b': 'C',
}

/**
 * Máximo 2 skills por dia. Grupo A nunca repete no mesmo dia e roda pelo
 * índice do dia; HSPU não combina com grupo A; T2B combina com qualquer um.
 *
 * `focusSkill` (skill prioritária do aluno) entra em todo dia de treino,
 * respeitando as mesmas combinações: foco em puxada fixa a vaga do grupo A,
 * foco em HSPU tira a puxada do dia (HSPU não combina com ela).
 */
export function selectSkillsForToday(allSkills: string[], dayIndex: number, focusSkill?: string | null): string[] {
  const focus = focusSkill && allSkills.includes(focusSkill) ? focusSkill : null

  const groupA = allSkills.filter(s => MUSCLE_GROUPS[s] === 'A')
  const groupB = allSkills.filter(s => MUSCLE_GROUPS[s] === 'B')
  const groupC = allSkills.filter(s => MUSCLE_GROUPS[s] === 'C')

  // Com foco, a combinação parte da skill prioritária (vale para qualquer
  // quantidade de skills, inclusive 2: puxada + HSPU nunca saem juntas).
  if (focus) {
    const group = MUSCLE_GROUPS[focus]
    const partnerC = groupC.length > 0 ? groupC[dayIndex % groupC.length] : null
    if (group === 'A' || group === 'B') return partnerC ? [focus, partnerC] : [focus]
    if (group === 'C') {
      const other = groupA.length > 0 ? groupA[dayIndex % groupA.length] : groupB[0]
      return other ? [other, focus] : [focus]
    }
  }

  if (allSkills.length <= 2) return allSkills

  const selected: string[] = []

  if (groupA.length > 0) selected.push(groupA[dayIndex % groupA.length])

  if (selected.length < 2) {
    if (groupC.length > 0) {
      selected.push(groupC[dayIndex % groupC.length])
    } else if (groupB.length > 0 && !selected.some(s => MUSCLE_GROUPS[s] === 'A')) {
      selected.push(groupB[0])
    }
  }

  if (selected.length === 0) {
    if (groupB.length > 0) selected.push(groupB[0])
    if (groupC.length > 0 && selected.length < 2) selected.push(groupC[0])
  }

  return selected.slice(0, 2)
}

/**
 * Exercícios que o aluno consegue fazer com o equipamento que tem.
 * Exercício sem equipamento cadastrado (lista vazia) vale para todos.
 * Sem equipamento informado pelo aluno, nada é filtrado.
 */
export function filterByEquipment<T extends { equipment?: string[] | null }>(pool: T[], available: string[] | null | undefined): T[] {
  if (!available || available.length === 0) return pool
  const have = new Set(available)
  return pool.filter(e => (e.equipment ?? []).every(req => have.has(req)))
}

// ─── Perfil adaptativo ────────────────────────────────────────────────────────

/**
 * Monta o perfil a partir do histórico já buscado.
 * @param recentWorkoutIds ids das últimas sessões concluídas da skill, da mais recente para a mais antiga (até 3)
 * @param results resultados dessas sessões
 * @param previousItems itens da segunda sessão mais recente (como no original)
 */
export function buildAdaptiveProfile(
  recentWorkoutIds: string[],
  results: HistoryResult[],
  previousItems: HistoryItem[],
): AdaptiveProfile {
  const last2Ids = recentWorkoutIds.slice(0, 2)

  const byWorkout = new Map<string, HistoryResult[]>()
  for (const r of results) {
    const list = byWorkout.get(r.daily_workout_id) ?? []
    list.push(r)
    byWorkout.set(r.daily_workout_id, list)
  }

  const didSomething = (r: HistoryResult) =>
    (r.reps_achieved ?? 0) > 0 || (r.time_achieved_sec ?? 0) > 0

  const consistentlyMet = new Set<string>()
  if (last2Ids.length === 2) {
    const w1 = byWorkout.get(last2Ids[0]) ?? []
    const w2 = byWorkout.get(last2Ids[1]) ?? []
    for (const r1 of w1) {
      const r2 = w2.find(r => r.skill_exercise_id === r1.skill_exercise_id)
      if (r2 && didSomething(r1) && didSomething(r2)) consistentlyMet.add(r1.skill_exercise_id)
    }
  }

  const efforts = new Map<string, number[]>()
  for (const r of results.filter(r => last2Ids.includes(r.daily_workout_id))) {
    const list = efforts.get(r.skill_exercise_id) ?? []
    list.push(r.perceived_effort ?? 3)
    efforts.set(r.skill_exercise_id, list)
  }
  const highEffortExercises = new Set<string>()
  for (const [id, list] of efforts) {
    if (list.reduce((a, b) => a + b, 0) / list.length >= 4) highEffortExercises.add(id)
  }

  const all = results.map(r => r.perceived_effort ?? 3)
  const recentAvgEffort = all.length > 0 ? all.reduce((a, b) => a + b, 0) / all.length : 3

  const usedForcaYesterday = new Set(
    previousItems.filter(i => i.category === 'forca').map(i => i.skill_exercise_id),
  )

  return { consistentlyMet, highEffortExercises, recentAvgEffort, usedForcaYesterday }
}

export const EMPTY_PROFILE: AdaptiveProfile = {
  consistentlyMet: new Set(),
  highEffortExercises: new Set(),
  recentAvgEffort: 3,
  usedForcaYesterday: new Set(),
}

/** +2 meta consistente, −3 esforço alto, −2 força usada na sessão anterior. */
export function scoreExercise(ex: Pick<SkillExercise, 'id' | 'category'>, profile: AdaptiveProfile): number {
  let score = 0
  if (profile.consistentlyMet.has(ex.id)) score += 2
  if (profile.highEffortExercises.has(ex.id)) score -= 3
  if (ex.category === 'forca' && profile.usedForcaYesterday.has(ex.id)) score -= 2
  return score
}

// ─── Aleatoriedade determinística ─────────────────────────────────────────────

/** Semente por aluno × dia × semana: mesmo dia gera o mesmo treino; alunos diferentes, ordens diferentes. */
export function workoutSeed(userId: string, dateISO: string, weekNumber: number): number {
  const userSeedBase = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return parseInt(dateISO.replace(/-/g, ''), 10) + weekNumber + userSeedBase
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = (seed * (i + 7)) % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Progressão semanal de volume ─────────────────────────────────────────────

export function adjustSets(baseSets: number, week: number): number {
  if (week >= 7) return Math.min(baseSets + 1, 5)
  return baseSets
}

export function adjustReps(baseReps: number, week: number, level: string): number {
  const increment = week <= 2 ? 0 : week <= 4 ? 1 : week <= 6 ? 2 : 3
  const max = level === 'avancado' ? 15 : level === 'intermediario' ? 12 : 10
  return Math.min(baseReps + increment, max)
}

export function adjustTime(baseSec: number, week: number): number {
  const increment = week <= 2 ? 0 : week <= 4 ? 5 : week <= 6 ? 10 : 15
  return baseSec + increment
}

// ─── Seleção de exercícios ────────────────────────────────────────────────────

export function normalizeLevel(level: string): Protocol {
  return level === 'intermediario' || level === 'avancado' ? level : 'iniciante'
}

/**
 * Escolhe e ajusta os exercícios do treino a partir do pool da skill no nível.
 * Ordena cada categoria por embaralhamento determinístico e depois pela
 * pontuação adaptativa (sort estável), e aplica a composição do nível.
 */
export function selectExercisesFromPool<T extends SkillExercise>(params: {
  pool: T[]
  level: string
  weekNumber: number
  seed: number
  profile?: AdaptiveProfile
}): T[] {
  const { pool, level, weekNumber, seed } = params
  const profile = params.profile ?? EMPTY_PROFILE
  if (pool.length === 0) return []

  const prioritize = (category: ExerciseCategory) =>
    seededShuffle(pool.filter(e => e.category === category), seed)
      .sort((a, b) => scoreExercise(b, profile) - scoreExercise(a, profile))

  const selected = buildWorkoutSelection(
    {
      core: prioritize('core'),
      forca: prioritize('forca'),
      mobilidade: prioritize('mobilidade'),
      skill: prioritize('skill'),
    },
    normalizeLevel(level),
  )

  return selected.map(e => ({
    ...e,
    sets: adjustSets(e.sets, weekNumber),
    reps: e.reps ? adjustReps(e.reps, weekNumber, level) : null,
    time_sec: e.time_sec ? adjustTime(e.time_sec, weekNumber) : null,
  }))
}

// ─── Agenda ───────────────────────────────────────────────────────────────────

/**
 * Dia de descanso = o aluno escolheu dias de treino e hoje não é um deles.
 * Sem dias escolhidos, todo dia é dia de treino. `dayOfWeek`: 0 = domingo.
 */
export function isRestDay(trainingDays: number[], dayOfWeek: number): boolean {
  return trainingDays.length > 0 && !trainingDays.includes(dayOfWeek)
}
