/**
 * ThaixSkill — Sessão de treino em andamento
 *
 * Estado e regras da tela de execução do treino (séries, esforço, envio),
 * sem React. A tela só guarda esse estado e chama estas funções.
 */

import { bestOfSets } from './business-rules'

export type SetValues = (number | null)[]

export type ExerciseLog = {
  skill_exercise_id: string
  reps_per_set?: SetValues
  time_per_set?: SetValues
  /** 1 a 5; `undefined` enquanto o aluno não escolheu. */
  perceived_effort?: number
}

/** Chave do resultado: o mesmo exercício pode aparecer duas vezes no treino. */
export function logKey(skillExerciseId: string, index: number): string {
  return `${skillExerciseId}-${index}`
}

export function emptySets(totalSets: number): SetValues {
  return Array<number | null>(Math.max(1, totalSets)).fill(null)
}

export function filledCount(values: SetValues | undefined): number {
  return (values ?? []).filter(v => v !== null).length
}

/** Primeira série ainda vazia; -1 quando todas foram registradas. */
export function activeSetIndex(values: SetValues): number {
  return values.findIndex(v => v === null)
}

/** Ajusta as reps de uma série com +/−, nunca abaixo de zero. */
export function adjustSet(values: SetValues, index: number, delta: number): SetValues {
  const next = [...values]
  next[index] = Math.max(0, (next[index] ?? 0) + delta)
  return next
}

export function setValueAt(values: SetValues, index: number, value: number): SetValues {
  const next = [...values]
  next[index] = Math.max(0, Math.round(value))
  return next
}

/** O botão de avançar só aparece com todas as séries e o esforço preenchidos. */
export function canAdvance(log: ExerciseLog | undefined, totalSets: number, timeBased: boolean): boolean {
  if (!log || log.perceived_effort === undefined) return false
  const values = timeBased ? log.time_per_set : log.reps_per_set
  return filledCount(values) === Math.max(1, totalSets)
}

/** Melhor série registrada; `undefined` se nenhuma série foi preenchida. */
export function bestRecorded(values: SetValues | undefined): number | undefined {
  return filledCount(values) > 0 ? bestOfSets(values!) : undefined
}

export type CompletionItem = {
  skill_exercise_id: string
  reps_per_set?: SetValues
  time_per_set?: SetValues
  reps_achieved?: number
  time_achieved_sec?: number
  perceived_effort: number
}

/**
 * Monta o corpo de /api/workouts/complete: um item por exercício.
 * Exercício repetido no treino fica com o registro de maior esforço.
 */
export function buildCompletionPayload(logs: ExerciseLog[]): CompletionItem[] {
  const byExercise = new Map<string, CompletionItem>()
  for (const log of logs) {
    if (log.perceived_effort === undefined) continue
    const item: CompletionItem = {
      skill_exercise_id: log.skill_exercise_id,
      reps_per_set: log.reps_per_set,
      time_per_set: log.time_per_set,
      reps_achieved: bestRecorded(log.reps_per_set),
      time_achieved_sec: bestRecorded(log.time_per_set),
      perceived_effort: log.perceived_effort,
    }
    const existing = byExercise.get(log.skill_exercise_id)
    if (!existing || item.perceived_effort > existing.perceived_effort) {
      byExercise.set(log.skill_exercise_id, item)
    }
  }
  return [...byExercise.values()]
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
