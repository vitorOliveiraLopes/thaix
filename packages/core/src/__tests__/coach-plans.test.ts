import { describe, it, expect } from 'vitest'
import {
  applyOps,
  matchExercise,
  normalizeText,
  planCustomWorkout,
  previousLevel,
  recommendExercises,
  validateTarget,
  type CatalogExercise,
  type PlanItem,
} from '../index'

const ex = (id: string, name: string, level: string, category = 'skill', extra: Partial<CatalogExercise> = {}): CatalogExercise => ({
  id,
  skill_id: 'pull-up',
  exercise_name: name,
  category,
  level,
  sets: 3,
  reps: 5,
  time_sec: null,
  rest_sec: 90,
  note: null,
  equipment: [],
  ...extra,
})

const pool: CatalogExercise[] = [
  ex('a', 'Pull-up negativa', 'iniciante'),
  ex('b', 'Pull-up negativa', 'intermediario'),
  ex('c', 'Remada australiana', 'iniciante', 'forca'),
  ex('d', 'Pull-up com pausa', 'intermediario'),
  ex('e', 'Pull-up com peso', 'avancado'),
  ex('f', 'Hollow hold', 'intermediario', 'core', { reps: null, time_sec: 30 }),
  ex('g', 'Ring row', 'intermediario', 'forca', { equipment: ['argolas'] }),
]

describe('nomes de exercício', () => {
  it('ignora acento, caixa e pontuação', () => {
    expect(normalizeText('Pull-Up  Negatíva!')).toBe('pull up negativa')
  })

  it('acha pelo nome, por parte dele ou por palavras', () => {
    expect(matchExercise(pool, 'remada').match?.id).toBe('c')
    expect(matchExercise(pool, 'hollow').match?.id).toBe('f')
    expect(matchExercise(pool, 'pull up pausa').match?.id).toBe('d')
  })

  it('devolve candidatos quando é ambíguo', () => {
    const r = matchExercise(pool, 'pull-up')
    expect(r.match).toBeNull()
    expect(r.candidates.length).toBeGreaterThan(1)
  })
})

describe('recomendação', () => {
  it('nível atual primeiro, depois um abaixo, sem o próximo nível', () => {
    const r = recommendExercises(pool, { level: 'intermediario', equipment: ['barra'], exclude: ['d'] })
    expect(r.map(x => x.id)).toEqual(['b', 'f', 'a', 'c'])
    expect(r[0].fit).toBe('nivel_atual')
    expect(r.at(-1)?.fit).toBe('mais_facil')
  })

  it('próximo nível só quando pedido', () => {
    const r = recommendExercises(pool, { level: 'intermediario', includeNextLevel: true, category: 'skill' })
    expect(r.find(x => x.id === 'e')?.fit).toBe('proximo_nivel')
  })
})

describe('treino personalizado', () => {
  it('usa o exercício do nível do aluno e a meta da semana', () => {
    const r = planCustomWorkout(pool, ['pull-up negativa', 'hollow'], { skillId: 'pull-up', level: 'intermediario', weekNumber: 3 })
    expect(r.items.map(i => i.id)).toEqual(['b', 'f'])
    expect(r.items[0].target).toEqual({ sets: 3, reps: 6, time_sec: null })
    expect(r.items[1].target).toEqual({ sets: 3, reps: null, time_sec: 35 })
  })

  it('separa o que não existe, o que é difícil demais e o ambíguo', () => {
    const r = planCustomWorkout(pool, ['burpee', 'pull-up com peso', 'pull-up'], { skillId: 'pull-up', level: 'intermediario', weekNumber: 1 })
    expect(r.missing).toEqual(['burpee'])
    expect(r.tooHard).toEqual(['pull-up com peso'])
    expect(r.ambiguous[0].query).toBe('pull-up')
    expect(r.items).toHaveLength(0)
  })

  it('não repete exercício', () => {
    const r = planCustomWorkout(pool, ['remada', 'remada australiana'], { skillId: 'pull-up', level: 'iniciante', weekNumber: 1 })
    expect(r.items).toHaveLength(1)
  })
})

describe('meta e nível', () => {
  it('valida a meta pedida', () => {
    expect(validateTarget({ sets: 3, reps: 5, time_sec: null }, { sets: 4, reps: 8 })).toEqual({ sets: 4, reps: 8, time_sec: null })
    expect(validateTarget({ sets: 3, reps: 5, time_sec: null }, { time_sec: 30 })).toHaveProperty('error')
    expect(validateTarget({ sets: 3, reps: null, time_sec: 30 }, { sets: 9 })).toHaveProperty('error')
    expect(validateTarget({ sets: 3, reps: 5, time_sec: null }, { sets: 3 })).toHaveProperty('error')
  })

  it('volta um nível', () => {
    expect(previousLevel('avancado')).toBe('intermediario')
    expect(previousLevel('iniciante')).toBeNull()
  })

  it('aplica adicionar e mudar meta na prévia', () => {
    const items: PlanItem[] = [{ order_index: 1, skill_exercise_id: 'a', sets: 3, reps: 5, time_sec: null, exercise: { id: 'a', exercise_name: 'A', category: 'skill', level: 'iniciante', skill_id: 'pull-up', rest_sec: 90 } }]
    const out = applyOps(
      items,
      [
        { type: 'set_target', order_index: 1, sets: 4, reps: 6, time_sec: null },
        { type: 'add', skill_exercise_id: 'c', sets: 3, reps: 8, time_sec: null },
      ],
      { c: { id: 'c', exercise_name: 'C', category: 'forca', level: 'iniciante', skill_id: 'pull-up', rest_sec: 60 } },
    )
    expect(out.map(i => [i.order_index, i.sets, i.reps])).toEqual([
      [1, 4, 6],
      [2, 3, 8],
    ])
  })
})
