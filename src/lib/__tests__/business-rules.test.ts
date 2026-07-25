import { describe, it, expect } from 'vitest'
import {
  calculateOnboardingScore,
  recommendProtocol,
  takeWithoutRepeat,
  buildWorkoutSelection,
  metGoal,
  sessionMetAllGoals,
  averageEffort,
  shouldProgressLevel,
  nextLevel,
  evaluateAchievements,
  detectNewPRs,
  calculateStreak,
  type ExerciseGoal,
  type ExerciseResult,
  type AchievementRule,
} from '../business-rules'

describe('calculateOnboardingScore', () => {
  it('soma push-ups + pull-ups×2 + squats/2', () => {
    expect(calculateOnboardingScore(10, 3, 30)).toBe(10 + 6 + 15)
  })
  it('funciona com zeros', () => {
    expect(calculateOnboardingScore(0, 0, 0)).toBe(0)
  })
})

describe('recommendProtocol', () => {
  it('25 push-ups + 6 pull-ups → avançado (regra forte)', () => {
    expect(recommendProtocol(25, 6, 20)).toBe('avancado')
  })
  it('0 pull-ups e score < 8 → iniciante', () => {
    expect(recommendProtocol(3, 0, 8)).toBe('iniciante')
  })
  it('0 pull-ups e score ≥ 8 → intermediário (teto, sem barra)', () => {
    expect(recommendProtocol(5, 0, 20)).toBe('intermediario')
  })
  it('score < 10 (com pull-ups) → iniciante', () => {
    expect(recommendProtocol(2, 1, 10)).toBe('iniciante')
  })
  it('score entre 10 e 25 → intermediário', () => {
    expect(recommendProtocol(4, 1, 10)).toBe('intermediario')
  })
  it('score ≥ 25 → avançado', () => {
    expect(recommendProtocol(10, 3, 30)).toBe('avancado')
  })
})

describe('takeWithoutRepeat', () => {
  it('retorna os primeiros n itens quando o pool é suficiente', () => {
    expect(takeWithoutRepeat([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3])
  })
  it('nunca repete: retorna no máximo o tamanho do pool', () => {
    expect(takeWithoutRepeat([1], 2)).toEqual([1])
  })
  it('pool vazio retorna array vazio', () => {
    expect(takeWithoutRepeat([], 3)).toEqual([])
  })
})

describe('buildWorkoutSelection', () => {
  const makePool = (core: number, forca: number, mobilidade: number, skill: number) => ({
    core: Array.from({ length: core }, (_, i) => `core-${i}`),
    forca: Array.from({ length: forca }, (_, i) => `forca-${i}`),
    mobilidade: Array.from({ length: mobilidade }, (_, i) => `mob-${i}`),
    skill: Array.from({ length: skill }, (_, i) => `skill-${i}`),
  })

  it('iniciante com pool completo gera 5 exercícios sem repetição', () => {
    const pool = makePool(3, 5, 0, 2)
    const result = buildWorkoutSelection(pool, 'iniciante')
    expect(result).toHaveLength(5)
    expect(new Set(result).size).toBe(result.length)
  })

  it('avançado com pool raso (1 core, 1 forca, 2 skill) nunca repete exercício', () => {
    const pool = makePool(1, 1, 0, 2)
    const result = buildWorkoutSelection(pool, 'avancado')
    const coreItems = result.filter(x => x.startsWith('core-'))
    expect(coreItems).toHaveLength(1)
    expect(new Set(result).size).toBe(result.length)
  })

  it('intermediário com pool completo gera 6 exercícios', () => {
    const pool = makePool(2, 4, 0, 2)
    const result = buildWorkoutSelection(pool, 'intermediario')
    expect(result).toHaveLength(6)
  })
})

describe('metGoal', () => {
  it('bate a meta de reps', () => {
    const goal: ExerciseGoal = { skill_exercise_id: 'e1', reps: 8 }
    expect(metGoal(goal, { skill_exercise_id: 'e1', reps_achieved: 8, perceived_effort: 2 })).toBe(true)
    expect(metGoal(goal, { skill_exercise_id: 'e1', reps_achieved: 7, perceived_effort: 2 })).toBe(false)
  })
  it('bate a meta de tempo', () => {
    const goal: ExerciseGoal = { skill_exercise_id: 'e1', time_sec: 15 }
    expect(metGoal(goal, { skill_exercise_id: 'e1', time_achieved_sec: 16, perceived_effort: 2 })).toBe(true)
    expect(metGoal(goal, { skill_exercise_id: 'e1', time_achieved_sec: 10, perceived_effort: 2 })).toBe(false)
  })
})

describe('sessionMetAllGoals', () => {
  const goals: ExerciseGoal[] = [
    { skill_exercise_id: 'e1', reps: 8 },
    { skill_exercise_id: 'e2', time_sec: 15 },
  ]
  it('true quando todos os exercícios bateram meta', () => {
    const results: ExerciseResult[] = [
      { skill_exercise_id: 'e1', reps_achieved: 10, perceived_effort: 2 },
      { skill_exercise_id: 'e2', time_achieved_sec: 20, perceived_effort: 2 },
    ]
    expect(sessionMetAllGoals(goals, results)).toBe(true)
  })
  it('false quando um exercício não bateu meta', () => {
    const results: ExerciseResult[] = [
      { skill_exercise_id: 'e1', reps_achieved: 5, perceived_effort: 2 },
      { skill_exercise_id: 'e2', time_achieved_sec: 20, perceived_effort: 2 },
    ]
    expect(sessionMetAllGoals(goals, results)).toBe(false)
  })
  it('false quando resultado não tem meta correspondente', () => {
    const results: ExerciseResult[] = [
      { skill_exercise_id: 'e3', reps_achieved: 10, perceived_effort: 2 },
    ]
    expect(sessionMetAllGoals(goals, results)).toBe(false)
  })
})

describe('averageEffort', () => {
  it('calcula a média corretamente', () => {
    const results: ExerciseResult[] = [
      { skill_exercise_id: 'e1', perceived_effort: 2 },
      { skill_exercise_id: 'e2', perceived_effort: 3 },
    ]
    expect(averageEffort(results)).toBe(2.5)
  })
  it('array vazio retorna 0', () => {
    expect(averageEffort([])).toBe(0)
  })
})

describe('shouldProgressLevel', () => {
  it('avança quando 2 sessões bateram meta e esforço médio ≤ 2.5', () => {
    const results: ExerciseResult[] = [
      { skill_exercise_id: 'e1', perceived_effort: 2 },
      { skill_exercise_id: 'e2', perceived_effort: 2 },
    ]
    expect(shouldProgressLevel({
      currentLevel: 'iniciante', sessionsAllMetGoal: [true, true], results,
    })).toBe(true)
  })
  it('NÃO avança se esforço médio > 2.5 (ainda desafiador)', () => {
    const results: ExerciseResult[] = [
      { skill_exercise_id: 'e1', perceived_effort: 4 },
      { skill_exercise_id: 'e2', perceived_effort: 3 },
    ]
    expect(shouldProgressLevel({
      currentLevel: 'iniciante', sessionsAllMetGoal: [true, true], results,
    })).toBe(false)
  })
  it('NÃO avança se alguma sessão não bateu todas as metas', () => {
    expect(shouldProgressLevel({
      currentLevel: 'iniciante',
      sessionsAllMetGoal: [true, false],
      results: [{ skill_exercise_id: 'e1', perceived_effort: 1 }],
    })).toBe(false)
  })
  it('NÃO avança com menos de 2 sessões avaliadas', () => {
    expect(shouldProgressLevel({
      currentLevel: 'iniciante',
      sessionsAllMetGoal: [true],
      results: [{ skill_exercise_id: 'e1', perceived_effort: 1 }],
    })).toBe(false)
  })
  it('nível avançado nunca progride (já é o topo)', () => {
    expect(shouldProgressLevel({
      currentLevel: 'avancado',
      sessionsAllMetGoal: [true, true],
      results: [{ skill_exercise_id: 'e1', perceived_effort: 1 }],
    })).toBe(false)
  })
})

describe('nextLevel', () => {
  it('iniciante → intermediario', () => { expect(nextLevel('iniciante')).toBe('intermediario') })
  it('intermediario → avancado', () => { expect(nextLevel('intermediario')).toBe('avancado') })
  it('avancado permanece avancado', () => { expect(nextLevel('avancado')).toBe('avancado') })
})

describe('evaluateAchievements', () => {
  const rules: AchievementRule[] = [
    { id: 'first-workout', type: 'session_count', threshold: 1 },
    { id: 'ten-workouts', type: 'session_count', threshold: 10 },
    { id: 'pike-pushup', type: 'skill_exercise', skill_exercise_id: 'ex-pike' },
    { id: 'hspu-intermediario', type: 'skill_level', skill_id: 'hspu', target_level: 'intermediario' },
  ]

  it('desbloqueia conquista de sessão quando threshold é atingido', () => {
    const result = evaluateAchievements(rules, {
      totalWorkoutsCompleted: 1, executedExerciseIds: new Set(),
      latestLevelUp: null, alreadyUnlockedIds: new Set(),
    })
    expect(result).toContain('first-workout')
    expect(result).not.toContain('ten-workouts')
  })

  it('desbloqueia conquista de exercício quando executado', () => {
    const result = evaluateAchievements(rules, {
      totalWorkoutsCompleted: 0, executedExerciseIds: new Set(['ex-pike']),
      latestLevelUp: null, alreadyUnlockedIds: new Set(),
    })
    expect(result).toContain('pike-pushup')
  })

  it('desbloqueia conquista de nível quando skill/nível batem', () => {
    const result = evaluateAchievements(rules, {
      totalWorkoutsCompleted: 0, executedExerciseIds: new Set(),
      latestLevelUp: { skillId: 'hspu', toLevel: 'intermediario' },
      alreadyUnlockedIds: new Set(),
    })
    expect(result).toContain('hspu-intermediario')
  })

  it('NÃO desbloqueia conquista de nível se a skill for diferente', () => {
    const result = evaluateAchievements(rules, {
      totalWorkoutsCompleted: 0, executedExerciseIds: new Set(),
      latestLevelUp: { skillId: 'pull-up', toLevel: 'intermediario' },
      alreadyUnlockedIds: new Set(),
    })
    expect(result).not.toContain('hspu-intermediario')
  })

  it('nunca desbloqueia conquista já desbloqueada (anti-spam)', () => {
    const result = evaluateAchievements(rules, {
      totalWorkoutsCompleted: 1, executedExerciseIds: new Set(['ex-pike']),
      latestLevelUp: null,
      alreadyUnlockedIds: new Set(['first-workout', 'pike-pushup']),
    })
    expect(result).not.toContain('first-workout')
    expect(result).not.toContain('pike-pushup')
  })
})

describe('detectNewPRs', () => {
  it('registra novo PR quando supera o recorde anterior', () => {
    const existing = [{ exerciseId: 'e1', value: 10, unit: 'reps' as const }]
    const results: ExerciseResult[] = [{ skill_exercise_id: 'e1', reps_achieved: 12, perceived_effort: 2 }]
    expect(detectNewPRs(existing, results)).toEqual([{ exerciseId: 'e1', value: 12, unit: 'reps' }])
  })
  it('NÃO registra PR quando resultado é igual ou menor que o recorde', () => {
    const existing = [{ exerciseId: 'e1', value: 10, unit: 'reps' as const }]
    const results: ExerciseResult[] = [{ skill_exercise_id: 'e1', reps_achieved: 10, perceived_effort: 2 }]
    expect(detectNewPRs(existing, results)).toEqual([])
  })
  it('primeiro resultado de um exercício sem histórico é sempre PR', () => {
    const results: ExerciseResult[] = [{ skill_exercise_id: 'e1', reps_achieved: 5, perceived_effort: 2 }]
    expect(detectNewPRs([], results)).toEqual([{ exerciseId: 'e1', value: 5, unit: 'reps' }])
  })
  it('trata reps e tempo como unidades independentes', () => {
    const existing = [{ exerciseId: 'e1', value: 10, unit: 'reps' as const }]
    const results: ExerciseResult[] = [
      { skill_exercise_id: 'e1', reps_achieved: 5, time_achieved_sec: 30, perceived_effort: 2 },
    ]
    expect(detectNewPRs(existing, results)).toEqual([{ exerciseId: 'e1', value: 30, unit: 'seconds' }])
  })
})

describe('calculateStreak', () => {
  it('3 dias consecutivos até hoje → streak 3', () => {
    expect(calculateStreak(['2026-07-19', '2026-07-20', '2026-07-21'], '2026-07-21')).toBe(3)
  })
  it('último treino foi ontem → streak continua válido', () => {
    expect(calculateStreak(['2026-07-20'], '2026-07-21')).toBe(1)
  })
  it('gap de mais de 1 dia zera o streak', () => {
    expect(calculateStreak(['2026-07-18'], '2026-07-21')).toBe(0)
  })
  it('sem treinos → streak 0', () => {
    expect(calculateStreak([], '2026-07-21')).toBe(0)
  })
  it('quebra de sequência no meio para de contar', () => {
    expect(calculateStreak(['2026-07-17', '2026-07-20', '2026-07-21'], '2026-07-21')).toBe(2)
  })
})
