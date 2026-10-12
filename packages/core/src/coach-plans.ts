/**
 * ThaixSkill — Planejadores do coach a partir do catálogo (sem I/O)
 *
 * Criar treino, recomendar e adicionar exercícios, mudar metas e trocar de
 * nível. Os números sempre saem do catálogo da Thaís (skill_exercises) e da
 * progressão semanal do gerador; o modelo só escolhe O QUE fazer.
 */

import { adjustReps, adjustSets, adjustTime, filterByEquipment } from './generator'

// ─── Níveis ───────────────────────────────────────────────────────────────────

export const LEVEL_ORDER = ['iniciante', 'intermediario', 'avancado'] as const

export function levelIndex(level: string): number {
  return LEVEL_ORDER.indexOf(level as (typeof LEVEL_ORDER)[number])
}

/** Nível anterior, ou null se já é o primeiro. */
export function previousLevel(level: string): string | null {
  const i = levelIndex(level)
  return i > 0 ? LEVEL_ORDER[i - 1] : null
}

// ─── Encontrar exercício pelo nome ────────────────────────────────────────────

/** Minúsculas, sem acento, sem pontuação e com espaços simples. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Exercício do catálogo pelo nome que o aluno (ou o modelo) escreveu.
 * Ordem: nome igual → começa com → contém → todas as palavras presentes.
 * Empate em qualquer etapa = ambíguo (devolve os candidatos para perguntar).
 */
export function matchExercise<T extends { exercise_name: string }>(
  pool: T[],
  query: string,
): { match: T | null; candidates: T[] } {
  const q = normalizeText(query)
  if (!q) return { match: null, candidates: [] }
  const named = pool.map(e => ({ e, n: normalizeText(e.exercise_name) }))
  const words = q.split(' ')
  const stages = [
    (n: string) => n === q,
    (n: string) => n.startsWith(q),
    (n: string) => n.includes(q),
    (n: string) => words.every(w => n.includes(w)),
  ]
  for (const test of stages) {
    const hits = named.filter(x => test(x.n)).map(x => x.e)
    // O mesmo nome pode existir em níveis diferentes: o primeiro do pool vence
    // (quem chama ordena pelo nível preferido).
    const distinct: T[] = []
    for (const h of hits) if (!distinct.some(d => normalizeText(d.exercise_name) === normalizeText(h.exercise_name))) distinct.push(h)
    if (distinct.length === 1) return { match: distinct[0], candidates: [] }
    if (distinct.length > 1) return { match: null, candidates: distinct.slice(0, 5) }
  }
  return { match: null, candidates: [] }
}

// ─── Catálogo ─────────────────────────────────────────────────────────────────

export type CatalogExercise = {
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
  equipment?: string[] | null
}

/** Meta do catálogo com a progressão da semana (a mesma do gerador). */
export function catalogTarget(e: Pick<CatalogExercise, 'sets' | 'reps' | 'time_sec'>, level: string, weekNumber: number) {
  return {
    sets: adjustSets(e.sets, weekNumber),
    reps: e.reps ? adjustReps(e.reps, weekNumber, level) : null,
    time_sec: e.time_sec ? adjustTime(e.time_sec, weekNumber) : null,
  }
}

export type Recommendation = CatalogExercise & { fit: 'nivel_atual' | 'mais_facil' | 'proximo_nivel' }

/**
 * Exercícios do catálogo para sugerir ao aluno: do nível atual, depois um
 * nível abaixo; o próximo nível só quando pedido (para conhecer, não para
 * adicionar ao treino). Respeita o equipamento e pula o que já está no treino.
 */
export function recommendExercises(
  pool: CatalogExercise[],
  opts: { level: string; equipment?: string[] | null; exclude?: string[]; category?: string | null; includeNextLevel?: boolean; limit?: number },
): Recommendation[] {
  const cur = levelIndex(opts.level)
  const skip = new Set(opts.exclude ?? [])
  const fitOf = (level: string): Recommendation['fit'] | null => {
    const d = levelIndex(level) - cur
    if (d === 0) return 'nivel_atual'
    if (d === -1) return 'mais_facil'
    if (d === 1 && opts.includeNextLevel) return 'proximo_nivel'
    return null
  }
  const rank: Record<Recommendation['fit'], number> = { nivel_atual: 0, mais_facil: 1, proximo_nivel: 2 }
  return filterByEquipment(pool, opts.equipment)
    .filter(e => !skip.has(e.id) && (!opts.category || e.category === opts.category))
    .map(e => ({ e, fit: fitOf(e.level) }))
    .filter((x): x is { e: CatalogExercise; fit: Recommendation['fit'] } => x.fit !== null)
    .sort((a, b) => rank[a.fit] - rank[b.fit])
    .slice(0, opts.limit ?? 8)
    .map(x => ({ ...x.e, fit: x.fit }))
}

// ─── Treino personalizado ─────────────────────────────────────────────────────

export const MAX_WORKOUT_EXERCISES = 10

export type PlannedExercise = CatalogExercise & { target: { sets: number; reps: number | null; time_sec: number | null } }

/**
 * Monta um treino com exercícios escolhidos pelo nome. Só entram exercícios
 * da skill no nível do aluno ou abaixo; metas do catálogo com a progressão
 * da semana. Devolve também o que não foi encontrado ou é avançado demais.
 */
export function planCustomWorkout(
  pool: CatalogExercise[],
  names: string[],
  opts: { skillId: string; level: string; weekNumber: number },
): { items: PlannedExercise[]; missing: string[]; tooHard: string[]; ambiguous: { query: string; options: string[] }[] } {
  const cur = levelIndex(opts.level)
  // Nível atual primeiro: "Pull-up negativa" do nível do aluno vence a de outro nível.
  const ordered = pool
    .filter(e => e.skill_id === opts.skillId)
    .sort((a, b) => Math.abs(levelIndex(a.level) - cur) - Math.abs(levelIndex(b.level) - cur))
  const items: PlannedExercise[] = []
  const missing: string[] = []
  const tooHard: string[] = []
  const ambiguous: { query: string; options: string[] }[] = []

  for (const name of names.slice(0, MAX_WORKOUT_EXERCISES)) {
    const allowed = ordered.filter(e => levelIndex(e.level) <= cur)
    const { match, candidates } = matchExercise(allowed, name)
    if (match) {
      if (!items.some(i => i.id === match.id)) items.push({ ...match, target: catalogTarget(match, opts.level, opts.weekNumber) })
      continue
    }
    if (candidates.length) {
      ambiguous.push({ query: name, options: candidates.map(c => c.exercise_name) })
      continue
    }
    if (matchExercise(ordered, name).match) tooHard.push(name)
    else missing.push(name)
  }
  return { items, missing, tooHard, ambiguous }
}

// ─── Meta pedida pelo aluno ───────────────────────────────────────────────────

export const TARGET_LIMITS = { sets: [1, 6], reps: [1, 30], time_sec: [5, 300] } as const

/**
 * Nova meta para um exercício do treino. Mantém o tipo (reps ou tempo) e
 * limita a valores seguros; o treino passa a contar como ajustado.
 */
export function validateTarget(
  current: { sets: number; reps: number | null; time_sec: number | null },
  wanted: { sets?: unknown; reps?: unknown; time_sec?: unknown },
): { sets: number; reps: number | null; time_sec: number | null } | { error: string } {
  const num = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v))
  const sets = num(wanted.sets) ?? current.sets
  const reps = current.reps === null ? null : (num(wanted.reps) ?? current.reps)
  const time = current.time_sec === null ? null : (num(wanted.time_sec) ?? current.time_sec)

  if (current.reps === null && num(wanted.reps) !== undefined) return { error: 'Esse exercício é por tempo, não por repetições.' }
  if (current.time_sec === null && num(wanted.time_sec) !== undefined) return { error: 'Esse exercício é por repetições, não por tempo.' }
  const inRange = (v: number, [lo, hi]: readonly [number, number]) => Number.isInteger(v) && v >= lo && v <= hi
  if (!inRange(sets, TARGET_LIMITS.sets)) return { error: `Séries entre ${TARGET_LIMITS.sets[0]} e ${TARGET_LIMITS.sets[1]}.` }
  if (reps !== null && !inRange(reps, TARGET_LIMITS.reps)) return { error: `Repetições entre ${TARGET_LIMITS.reps[0]} e ${TARGET_LIMITS.reps[1]}.` }
  if (time !== null && !inRange(time, TARGET_LIMITS.time_sec)) return { error: `Tempo entre ${TARGET_LIMITS.time_sec[0]} e ${TARGET_LIMITS.time_sec[1]} segundos.` }
  if (sets === current.sets && reps === current.reps && time === current.time_sec) return { error: 'A meta já é essa.' }
  return { sets, reps, time_sec: time }
}
