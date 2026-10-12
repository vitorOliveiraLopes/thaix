/**
 * ThaixSkill — Regras do coach (sem I/O)
 *
 * O agente conversa e decide QUANDO ajustar; COMO ajustar sai daqui.
 * Cada planejador recebe o treino de hoje e devolve operações concretas
 * (tirar exercício, mudar séries, trocar exercício) + uma prévia legível.
 * A API grava essas operações só depois que o aluno confirma.
 */

import { MUSCLE_GROUPS, filterByEquipment, selectSkillsForToday } from './generator'
import { WEEKDAY_SHORT } from './catalog'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PlanExercise = {
  id: string
  exercise_name: string
  category: string
  level: string
  skill_id: string
  rest_sec: number
  equipment?: string[] | null
}

export type PlanItem = {
  order_index: number
  skill_exercise_id: string
  sets: number
  reps: number | null
  time_sec: number | null
  exercise: PlanExercise
}

export type WorkoutOp =
  | { type: 'remove'; order_index: number }
  | { type: 'set_sets'; order_index: number; sets: number }
  | { type: 'replace'; order_index: number; skill_exercise_id: string; sets: number; reps: number | null; time_sec: number | null }
  /** Novo exercício no fim do treino, com a meta do catálogo. */
  | { type: 'add'; skill_exercise_id: string; sets: number; reps: number | null; time_sec: number | null }
  /** Meta pedida pelo aluno (o treino passa a contar como ajustado). */
  | { type: 'set_target'; order_index: number; sets: number; reps: number | null; time_sec: number | null }

export type WorkoutPlan = {
  ops: WorkoutOp[]
  preview: string[]
  minutesBefore: number
  minutesAfter: number
}

// ─── Duração estimada ─────────────────────────────────────────────────────────

/** Segundos por repetição, em média, nos exercícios de skill. */
export const SECONDS_PER_REP = 3
/** Preparação e troca de exercício. */
export const SETUP_SECONDS = 45

export function estimateItemSeconds(item: Pick<PlanItem, 'sets' | 'reps' | 'time_sec'> & { exercise: Pick<PlanExercise, 'rest_sec'> }): number {
  const sets = Math.max(1, item.sets)
  const work = item.time_sec ?? (item.reps ?? 0) * SECONDS_PER_REP
  const rest = Math.max(0, item.exercise.rest_sec ?? 60)
  return SETUP_SECONDS + sets * work + (sets - 1) * rest
}

export function estimateWorkoutMinutes(items: Parameters<typeof estimateItemSeconds>[0][]): number {
  const total = items.reduce((sum, it) => sum + estimateItemSeconds(it), 0)
  return Math.round(total / 60)
}

function describe(item: PlanItem): string {
  const dose = item.time_sec ? `${item.time_sec}s` : `${item.reps} reps`
  return `${item.exercise.exercise_name} (${item.sets}×${dose})`
}

/** Ordem de corte: o que sai primeiro quando falta tempo. A skill sai por último. */
export const CUT_ORDER = ['mobilidade', 'core', 'forca', 'skill'] as const

function cutRank(category: string): number {
  const i = (CUT_ORDER as readonly string[]).indexOf(category)
  return i === -1 ? 0 : i
}

// ─── Encaixar no tempo ────────────────────────────────────────────────────────

/**
 * Encaixa o treino no tempo disponível.
 * 1. Tira exercícios na ordem mobilidade → core → força (do fim para o começo).
 * 2. Mantém pelo menos um exercício de skill e pelo menos um exercício no total.
 * 3. Se ainda passar, reduz séries (mínimo 2 na skill, 1 no resto).
 */
export function fitWorkoutToMinutes(items: PlanItem[], minutes: number): WorkoutPlan {
  const target = Math.max(5, minutes) * 60
  const before = estimateWorkoutMinutes(items)
  let kept = [...items]
  const ops: WorkoutOp[] = []
  const preview: string[] = []
  const seconds = () => kept.reduce((s, it) => s + estimateItemSeconds(it), 0)

  const removable = [...items]
    .filter(it => it.exercise.category !== 'skill')
    .sort((a, b) => cutRank(a.exercise.category) - cutRank(b.exercise.category) || b.order_index - a.order_index)

  for (const it of removable) {
    if (seconds() <= target || kept.length <= 1) break
    kept = kept.filter(k => k.order_index !== it.order_index)
    ops.push({ type: 'remove', order_index: it.order_index })
    preview.push(`Tirar ${it.exercise.exercise_name}`)
  }

  // Ainda longo: reduz séries, começando pelo que não é skill.
  const bySetsCut = [...kept].sort((a, b) => cutRank(a.exercise.category) - cutRank(b.exercise.category))
  let changed = true
  while (seconds() > target && changed) {
    changed = false
    for (const it of bySetsCut) {
      const min = it.exercise.category === 'skill' ? 2 : 1
      const current = kept.find(k => k.order_index === it.order_index)!
      if (current.sets > min && seconds() > target) {
        kept = kept.map(k => (k.order_index === it.order_index ? { ...k, sets: k.sets - 1 } : k))
        changed = true
      }
    }
  }

  for (const it of kept) {
    const original = items.find(o => o.order_index === it.order_index)!
    if (original.sets !== it.sets) {
      ops.push({ type: 'set_sets', order_index: it.order_index, sets: it.sets })
      preview.push(`${it.exercise.exercise_name}: ${original.sets} → ${it.sets} séries`)
    }
  }

  const after = estimateWorkoutMinutes(kept)
  if (ops.length === 0) preview.push(`O treino já cabe em ${minutes} min (cerca de ${before} min).`)
  else preview.push(`Duração estimada: ${before} → ${after} min`)
  return { ops, preview, minutesBefore: before, minutesAfter: after }
}

// ─── Aliviar ──────────────────────────────────────────────────────────────────

export type LightenIntensity = 'leve' | 'forte'

/**
 * Alivia o treino por cansaço ou treino pesado na box.
 * - leve: uma série a menos em tudo (mínimo 1).
 * - forte: além disso, tira a força acessória (a skill continua, com técnica).
 * `avoidPulling`: depois de WOD com muita puxada, tira força das skills de puxada.
 */
export function lightenWorkout(items: PlanItem[], intensity: LightenIntensity, avoidPulling = false): WorkoutPlan {
  const before = estimateWorkoutMinutes(items)
  const ops: WorkoutOp[] = []
  const preview: string[] = []
  let kept = [...items]

  const removeForca = intensity === 'forte' || avoidPulling
  if (removeForca) {
    for (const it of items) {
      const pulling = MUSCLE_GROUPS[it.exercise.skill_id] === 'A'
      if (it.exercise.category === 'forca' && (intensity === 'forte' || pulling) && kept.length > 1) {
        kept = kept.filter(k => k.order_index !== it.order_index)
        ops.push({ type: 'remove', order_index: it.order_index })
        preview.push(`Tirar ${it.exercise.exercise_name} (força acessória)`)
      }
    }
  }

  for (const it of kept) {
    if (it.sets > 1) {
      ops.push({ type: 'set_sets', order_index: it.order_index, sets: it.sets - 1 })
      preview.push(`${it.exercise.exercise_name}: ${it.sets} → ${it.sets - 1} séries`)
    }
  }

  const after = estimateWorkoutMinutes(
    kept.map(k => ({ ...k, sets: Math.max(1, k.sets - 1) })),
  )
  preview.push(`Duração estimada: ${before} → ${after} min`)
  return { ops, preview, minutesBefore: before, minutesAfter: after }
}

// ─── Trocar exercício ─────────────────────────────────────────────────────────

const LEVEL_ORDER = ['iniciante', 'intermediario', 'avancado']

/**
 * Candidatos para trocar um exercício: mesma skill e categoria, que o aluno
 * consegue fazer com o equipamento dele e que ainda não está no treino.
 * Preferência: mesmo nível, depois um nível abaixo (mais fácil).
 */
export function swapCandidates<T extends PlanExercise>(
  current: PlanExercise,
  pool: T[],
  inWorkoutIds: string[],
  equipment?: string[] | null,
): T[] {
  const lvl = LEVEL_ORDER.indexOf(current.level)
  const allowedLevels = new Set([current.level, LEVEL_ORDER[lvl - 1]].filter(Boolean))
  const skip = new Set([...inWorkoutIds, current.id])
  return filterByEquipment(pool, equipment)
    .filter(e => e.skill_id === current.skill_id && e.category === current.category && allowedLevels.has(e.level) && !skip.has(e.id))
    .sort((a, b) => (a.level === current.level ? 0 : 1) - (b.level === current.level ? 0 : 1))
}

export function swapPlan(item: PlanItem, replacement: PlanExercise & { sets: number; reps: number | null; time_sec: number | null }): WorkoutPlan {
  const before = estimateWorkoutMinutes([item])
  const newItem: PlanItem = { ...item, skill_exercise_id: replacement.id, sets: replacement.sets, reps: replacement.reps, time_sec: replacement.time_sec, exercise: replacement }
  return {
    ops: [
      {
        type: 'replace',
        order_index: item.order_index,
        skill_exercise_id: replacement.id,
        sets: replacement.sets,
        reps: replacement.reps,
        time_sec: replacement.time_sec,
      },
    ],
    preview: [`Trocar ${describe(item)}`, `por ${describe(newItem)}`],
    minutesBefore: before,
    minutesAfter: estimateWorkoutMinutes([newItem]),
  }
}

/** Aplica operações num treino (usado para prévia e para conferir antes de gravar). */
export function applyOps(items: PlanItem[], ops: WorkoutOp[], exercises: Record<string, PlanExercise> = {}): PlanItem[] {
  let out = [...items]
  for (const op of ops) {
    if (op.type === 'remove') out = out.filter(it => it.order_index !== op.order_index)
    if (op.type === 'set_sets') out = out.map(it => (it.order_index === op.order_index ? { ...it, sets: op.sets } : it))
    if (op.type === 'replace')
      out = out.map(it =>
        it.order_index === op.order_index
          ? { ...it, skill_exercise_id: op.skill_exercise_id, sets: op.sets, reps: op.reps, time_sec: op.time_sec, exercise: exercises[op.skill_exercise_id] ?? it.exercise }
          : it,
      )
    if (op.type === 'set_target')
      out = out.map(it => (it.order_index === op.order_index ? { ...it, sets: op.sets, reps: op.reps, time_sec: op.time_sec } : it))
    if (op.type === 'add') {
      const exercise = exercises[op.skill_exercise_id]
      if (exercise) {
        const order = out.reduce((m, it) => Math.max(m, it.order_index), 0) + 1
        out = [...out, { order_index: order, skill_exercise_id: op.skill_exercise_id, sets: op.sets, reps: op.reps, time_sec: op.time_sec, exercise }]
      }
    }
  }
  return out
}

// ─── Semana ───────────────────────────────────────────────────────────────────

export type WeekDay = { dow: number; label: string; training: boolean; skills: string[] }

/** Quais skills caem em cada dia de treino, com a mesma regra do gerador. */
export function weekPlan(trainingDays: number[], skillIds: string[], focusSkill?: string | null): WeekDay[] {
  return WEEKDAY_SHORT.map((label, dow) => {
    const training = trainingDays.length === 0 || trainingDays.includes(dow)
    return { dow, label, training, skills: training ? selectSkillsForToday(skillIds, dow, focusSkill) : [] }
  })
}

// ─── Filtro de saúde ──────────────────────────────────────────────────────────

export type HealthConcern = 'emergency' | 'injury' | null

const EMERGENCY = [
  /dor no peito/i,
  /aperto no peito/i,
  /falta de ar/i,
  /n[aã]o consigo respirar/i,
  /desmai/i,
  /perdi a consci[eê]ncia/i,
  /formigamento no bra[cç]o/i,
  /urina (escura|marrom|cor de coca)/i,
  /rabdo/i,
]

const INJURY = [
  /\bdor(es)?\b/i,
  /les[aã]o/i,
  /machuquei/i,
  /me machuquei/i,
  /estalo/i,
  /estalou/i,
  /torci/i,
  /incha(do|ço|ou)/i,
  /formig/i,
  /dormente|dorm[eê]ncia/i,
  /tendinite|bursite|luxa|distens/i,
  /incomodando|incômodo|incomodo/i,
]

/**
 * Classifica a mensagem antes de chamar o modelo.
 * - emergency: sinais de urgência → resposta fixa, sem IA.
 * - injury: dor ou lesão → o coach não prescreve e orienta um profissional.
 */
export function detectHealthConcern(text: string): HealthConcern {
  if (EMERGENCY.some(r => r.test(text))) return 'emergency'
  if (INJURY.some(r => r.test(text))) return 'injury'
  return null
}

export const EMERGENCY_REPLY =
  'Isso pode ser sério. Pare o treino agora e procure atendimento médico imediatamente ' +
  '(SAMU 192 ou o pronto-socorro mais próximo). Se estiver sozinho, avise alguém perto de você. ' +
  'Quando estiver tudo bem, a gente volta a falar de treino.'

// ─── Fora do escopo ───────────────────────────────────────────────────────────

export type OffTopic = 'nutrition' | 'other' | null

/** Termos de treino: se aparecem, a mensagem vai para o modelo decidir com contexto. */
const TRAINING_TERMS =
  /trein|wod|\bbox\b|crossfit|skill|pull|muscle|\bmu\b|hspu|parada de m[aã]o|t2b|toes|c2b|chest|kipping|butterfly|s[eé]ries?\b|\breps?\b|repeti[cç]|exerc[ií]cio|\bbarra\b|paralela|argola|aquec|mobilidade|alongament|descanso|recupera|n[ií]vel/i

const NUTRITION = [
  /o que (eu )?(posso|devo|vou) comer/i,
  /\bcomer\b.*\b(hoje|agora|janta|almo[cç]o|caf[eé])/i,
  /\breceitas?\b/i,
  /card[aá]pio/i,
  /\bdieta\b/i,
  /calorias?|macros?\b|prote[ií]na/i,
  /emagre[cç]|perder (peso|barriga|gordura)/i,
  /suplement|\bwhey\b|creatina|pr[eé][- ]?treino/i,
]

const OTHER = [
  /previs[aã]o do tempo|vai chover|como (est[aá]|vai estar) o (tempo|clima)|temperatura (hoje|amanh[aã]|agora)/i,
  /elei[cç][aã]o|pol[ií]tic|presidente|governo|not[ií]cias?\b/i,
  /futebol|brasileir[aã]o|libertadores|copa do mundo/i,
  /bitcoin|cripto|a[cç][oõ]es da bolsa|investiment|cota[cç][aã]o do d[oó]lar/i,
  /\bc[oó]digo\b|programa[cç][aã]o|\bpython\b|javascript/i,
  /reda[cç][aã]o|li[cç][aã]o de casa|tarefa da escola|trabalho da faculdade/i,
  /conta uma piada|me conta uma hist[oó]ria|escreve (um|uma) (poema|m[uú]sica|carta)/i,
  /\bhor[oó]scopo\b|\bsigno\b/i,
  /\bfilmes?\b|netflix|recomenda (um|uma) livro/i,
]

/**
 * Pergunta claramente fora do papel do coach. Só marca quando a mensagem
 * não fala de treino: "posso treinar com chuva?" vai para o modelo.
 */
export function detectOffTopic(text: string): OffTopic {
  if (TRAINING_TERMS.test(text)) return null
  if (NUTRITION.some(r => r.test(text))) return 'nutrition'
  if (OTHER.some(r => r.test(text))) return 'other'
  return null
}

export const OFF_TOPIC_REPLY: Record<Exclude<OffTopic, null>, string> = {
  nutrition:
    'Alimentação é com nutricionista 🙂 Aqui eu cuido do seu treino de skills, da recuperação e da hidratação. Quer ajustar algo no treino de hoje?',
  other:
    'Isso foge do que eu sei fazer 😅 Sou seu coach de skills: treino de hoje, progressão, técnica e a sua rotina. Bora falar de treino?',
}

/** Resposta quando o modelo só fez propostas, sem escrever texto. */
export function proposalReply(summaries: string[]): string {
  if (summaries.length === 0) return 'Não consegui responder agora. Tenta reformular?'
  if (summaries.length === 1) return `Preparei isso: ${summaries[0].charAt(0).toLowerCase()}${summaries[0].slice(1)}. Confirma aí embaixo 👇`
  return 'Preparei as propostas abaixo. Confirma o que fizer sentido 👇'
}

// ─── Box ──────────────────────────────────────────────────────────────────────

export const BOX_KINDS = ['wod', 'forca', 'ginastica', 'cardio', 'outro'] as const
export const BOX_STIMULI = ['puxada', 'empurrada', 'core', 'pernas', 'cardio'] as const

/** Sugestão para o dia a partir do treino da box registrado. */
export function boxRecommendation(sessions: { intensity: number; stimulus: string[] }[]): 'none' | 'lighten' | 'lighten_pulling' {
  const heavy = sessions.filter(s => s.intensity >= 4)
  if (heavy.length === 0) return 'none'
  return heavy.some(s => s.stimulus.includes('puxada')) ? 'lighten_pulling' : 'lighten'
}
