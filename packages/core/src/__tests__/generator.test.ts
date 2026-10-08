import { describe, it, expect } from 'vitest'
import {
  selectSkillsForToday,
  buildAdaptiveProfile,
  scoreExercise,
  workoutSeed,
  seededShuffle,
  adjustSets,
  adjustReps,
  adjustTime,
  normalizeLevel,
  selectExercisesFromPool,
  EMPTY_PROFILE,
  type SkillExercise,
  type HistoryResult,
} from '../generator'

function ex(id: string, category: string, extra: Partial<SkillExercise> = {}): SkillExercise {
  return {
    id,
    skill_id: 'pull-up',
    exercise_name: id,
    category,
    level: 'iniciante',
    sets: 3,
    reps: 8,
    time_sec: null,
    rest_sec: 60,
    note: null,
    order_index: 1,
    ...extra,
  }
}

describe('selectSkillsForToday', () => {
  it('devolve todas quando há até 2 skills', () => {
    expect(selectSkillsForToday(['pull-up', 'hspu'], 3)).toEqual(['pull-up', 'hspu'])
  })

  it('nunca junta duas skills de puxada no mesmo dia', () => {
    for (let day = 0; day < 7; day++) {
      const s = selectSkillsForToday(['pull-up', 'c2b', 'bmu', 't2b'], day)
      expect(s.filter(x => ['pull-up', 'c2b', 'bmu'].includes(x)).length).toBe(1)
      expect(s.length).toBeLessThanOrEqual(2)
    }
  })

  it('roda a skill de puxada conforme o dia', () => {
    const all = ['pull-up', 'c2b', 'bmu', 't2b']
    expect(selectSkillsForToday(all, 0)[0]).toBe('pull-up')
    expect(selectSkillsForToday(all, 1)[0]).toBe('c2b')
    expect(selectSkillsForToday(all, 2)[0]).toBe('bmu')
  })

  it('não combina HSPU com puxada', () => {
    const s = selectSkillsForToday(['pull-up', 'c2b', 'hspu'], 0)
    expect(s).toEqual(['pull-up'])
  })

  // Comportamento atual, registrado para validar com a Thaís: quando o aluno
  // tem puxada + T2B + HSPU, o T2B sempre ocupa a segunda vaga e o HSPU nunca
  // entra no treino. Ver docs/pendencias-thais.md.
  it('com puxada + T2B + HSPU, o HSPU fica de fora (comportamento atual)', () => {
    for (let day = 0; day < 7; day++) {
      expect(selectSkillsForToday(['pull-up', 't2b', 'hspu'], day)).not.toContain('hspu')
    }
  })
})

describe('buildAdaptiveProfile', () => {
  const results: HistoryResult[] = [
    { daily_workout_id: 'w1', skill_exercise_id: 'a', reps_achieved: 8, time_achieved_sec: null, perceived_effort: 2 },
    { daily_workout_id: 'w2', skill_exercise_id: 'a', reps_achieved: 7, time_achieved_sec: null, perceived_effort: 2 },
    { daily_workout_id: 'w1', skill_exercise_id: 'b', reps_achieved: 0, time_achieved_sec: null, perceived_effort: 5 },
    { daily_workout_id: 'w2', skill_exercise_id: 'b', reps_achieved: 3, time_achieved_sec: null, perceived_effort: 4 },
  ]

  it('marca meta consistente só quando fez nas duas últimas sessões', () => {
    const p = buildAdaptiveProfile(['w1', 'w2'], results, [])
    expect([...p.consistentlyMet]).toEqual(['a'])
  })

  it('marca esforço alto quando a média das duas últimas é ≥ 4', () => {
    const p = buildAdaptiveProfile(['w1', 'w2'], results, [])
    expect(p.highEffortExercises.has('b')).toBe(true)
    expect(p.highEffortExercises.has('a')).toBe(false)
  })

  it('calcula esforço médio recente e usa 3 sem histórico', () => {
    expect(buildAdaptiveProfile(['w1', 'w2'], results, []).recentAvgEffort).toBe(3.25)
    expect(buildAdaptiveProfile([], [], []).recentAvgEffort).toBe(3)
  })

  it('guarda só exercícios de força da sessão anterior', () => {
    const p = buildAdaptiveProfile(['w1', 'w2'], [], [
      { skill_exercise_id: 'f1', category: 'forca' },
      { skill_exercise_id: 'c1', category: 'core' },
    ])
    expect([...p.usedForcaYesterday]).toEqual(['f1'])
  })
})

describe('scoreExercise', () => {
  it('soma e subtrai os pesos do perfil', () => {
    const profile = {
      ...EMPTY_PROFILE,
      consistentlyMet: new Set(['a']),
      highEffortExercises: new Set(['b']),
      usedForcaYesterday: new Set(['c']),
    }
    expect(scoreExercise({ id: 'a', category: 'core' }, profile)).toBe(2)
    expect(scoreExercise({ id: 'b', category: 'core' }, profile)).toBe(-3)
    expect(scoreExercise({ id: 'c', category: 'forca' }, profile)).toBe(-2)
    expect(scoreExercise({ id: 'c', category: 'core' }, profile)).toBe(0)
  })
})

describe('aleatoriedade determinística', () => {
  it('a mesma semente gera a mesma ordem', () => {
    const arr = [1, 2, 3, 4, 5, 6]
    expect(seededShuffle(arr, 42)).toEqual(seededShuffle(arr, 42))
    expect(seededShuffle(arr, 42).sort()).toEqual(arr)
  })

  it('a semente muda com aluno, dia e semana', () => {
    const base = workoutSeed('user-a', '2026-10-07', 1)
    expect(workoutSeed('user-b', '2026-10-07', 1)).not.toBe(base)
    expect(workoutSeed('user-a', '2026-10-08', 1)).not.toBe(base)
    expect(workoutSeed('user-a', '2026-10-07', 2)).not.toBe(base)
  })
})

describe('progressão semanal', () => {
  it('séries sobem só a partir da semana 7, até 5', () => {
    expect(adjustSets(3, 6)).toBe(3)
    expect(adjustSets(3, 7)).toBe(4)
    expect(adjustSets(5, 9)).toBe(5)
  })

  it('reps sobem por bloco de semanas com teto por nível', () => {
    expect(adjustReps(8, 1, 'iniciante')).toBe(8)
    expect(adjustReps(8, 3, 'iniciante')).toBe(9)
    expect(adjustReps(8, 8, 'iniciante')).toBe(10)
    expect(adjustReps(10, 8, 'intermediario')).toBe(12)
    expect(adjustReps(14, 8, 'avancado')).toBe(15)
  })

  it('tempo sobe 5 s por bloco', () => {
    expect(adjustTime(20, 2)).toBe(20)
    expect(adjustTime(20, 4)).toBe(25)
    expect(adjustTime(20, 6)).toBe(30)
    expect(adjustTime(20, 7)).toBe(35)
  })
})

describe('selectExercisesFromPool', () => {
  const pool = [
    ex('core1', 'core'), ex('core2', 'core'), ex('core3', 'core'),
    ex('f1', 'forca'), ex('f2', 'forca'),
    ex('s1', 'skill', { reps: null, time_sec: 20 }), ex('s2', 'skill'),
  ]

  it('respeita a composição do iniciante (2 core, 1 força, 2 skill)', () => {
    const sel = selectExercisesFromPool({ pool, level: 'iniciante', weekNumber: 1, seed: 7 })
    expect(sel).toHaveLength(5)
    expect(sel.filter(e => e.category === 'core')).toHaveLength(2)
    expect(sel.filter(e => e.category === 'forca')).toHaveLength(1)
    expect(sel.filter(e => e.category === 'skill')).toHaveLength(2)
  })

  it('nunca repete exercício quando o pool é pequeno', () => {
    const small = [ex('c', 'core'), ex('s', 'skill')]
    const sel = selectExercisesFromPool({ pool: small, level: 'intermediario', weekNumber: 1, seed: 1 })
    expect(new Set(sel.map(e => e.id)).size).toBe(sel.length)
    expect(sel).toHaveLength(2)
  })

  it('prioriza o exercício com meta consistente e evita o de esforço alto', () => {
    const profile = { ...EMPTY_PROFILE, consistentlyMet: new Set(['core3']), highEffortExercises: new Set(['core1']) }
    const sel = selectExercisesFromPool({ pool, level: 'iniciante', weekNumber: 1, seed: 7, profile })
    const cores = sel.filter(e => e.category === 'core').map(e => e.id)
    expect(cores[0]).toBe('core3')
    expect(cores).not.toContain('core1')
  })

  it('aplica a progressão semanal em reps e tempo', () => {
    const sel = selectExercisesFromPool({ pool, level: 'iniciante', weekNumber: 4, seed: 7 })
    const timed = sel.find(e => e.id === 's1')!
    expect(timed.time_sec).toBe(25)
    expect(timed.reps).toBeNull()
    expect(sel.find(e => e.id === 's2')!.reps).toBe(9)
  })

  it('trata nível desconhecido como iniciante', () => {
    expect(normalizeLevel('qualquer')).toBe('iniciante')
    expect(selectExercisesFromPool({ pool: [], level: 'avancado', weekNumber: 1, seed: 1 })).toEqual([])
  })
})
