import { describe, it, expect } from 'vitest'
import {
  COACH_TOOLS,
  applyOps,
  boxRecommendation,
  detectHealthConcern,
  estimateWorkoutMinutes,
  filterByEquipment,
  fitWorkoutToMinutes,
  isWriteTool,
  lightenWorkout,
  selectSkillsForToday,
  swapCandidates,
  swapPlan,
  toolsForApi,
  weekPlan,
  type PlanItem,
} from '../index'

function item(order: number, category: string, sets = 3, extra: Partial<PlanItem> = {}): PlanItem {
  return {
    order_index: order,
    skill_exercise_id: `ex${order}`,
    sets,
    reps: 8,
    time_sec: null,
    exercise: { id: `ex${order}`, exercise_name: `Ex ${order} (${category})`, category, level: 'iniciante', skill_id: 'pull-up', rest_sec: 60 },
    ...extra,
  }
}

const WORKOUT = [item(1, 'core'), item(2, 'core'), item(3, 'forca'), item(4, 'skill'), item(5, 'skill')]

describe('foco e equipamento no gerador', () => {
  const all = ['pull-up', 'c2b', 'bmu', 't2b', 'hspu']

  it('foco em puxada entra todo dia, com T2B', () => {
    for (let d = 0; d < 7; d++) expect(selectSkillsForToday(all, d, 'bmu')).toEqual(['bmu', 't2b'])
  })

  it('foco em HSPU tira a puxada do dia e resolve o HSPU que nunca entrava', () => {
    for (let d = 0; d < 7; d++) {
      const s = selectSkillsForToday(['pull-up', 't2b', 'hspu'], d, 'hspu')
      expect(s).toContain('hspu')
      expect(s).not.toContain('pull-up')
    }
  })

  it('foco em HSPU com duas skills também respeita a combinação', () => {
    expect(selectSkillsForToday(['pull-up', 'hspu'], 1, 'hspu')).toEqual(['hspu'])
  })

  it('foco em puxada com HSPU também não junta os dois', () => {
    expect(selectSkillsForToday(['pull-up', 'hspu'], 2, 'pull-up')).toEqual(['pull-up'])
  })

  it('foco desconhecido é ignorado', () => {
    expect(selectSkillsForToday(['pull-up', 'c2b', 't2b'], 0, 'bmu')).toEqual(selectSkillsForToday(['pull-up', 'c2b', 't2b'], 0))
  })

  it('filtra por equipamento só quando o exercício tem requisito', () => {
    const pool = [{ id: 'a', equipment: ['barra'] }, { id: 'b', equipment: [] }, { id: 'c', equipment: null }, { id: 'd', equipment: ['argolas'] }]
    expect(filterByEquipment(pool, ['barra']).map(e => e.id)).toEqual(['a', 'b', 'c'])
    expect(filterByEquipment(pool, []).map(e => e.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('duração e encaixe no tempo', () => {
  it('estima a duração com trabalho, descanso e preparação', () => {
    // 3 séries × 24s + 2 descansos × 60s + 45s = 237s por exercício; 5 exercícios ≈ 20 min
    expect(estimateWorkoutMinutes(WORKOUT)).toBe(20)
  })

  it('corta core e força antes da skill', () => {
    const plan = fitWorkoutToMinutes(WORKOUT, 10)
    const after = applyOps(WORKOUT, plan.ops)
    expect(after.every(i => i.exercise.category === 'skill')).toBe(true)
    expect(plan.minutesAfter).toBeLessThanOrEqual(10)
    expect(plan.preview.join(' ')).toContain('Duração estimada')
  })

  it('reduz séries quando tirar exercícios não basta, sem deixar skill abaixo de 2', () => {
    const plan = fitWorkoutToMinutes(WORKOUT, 5)
    const after = applyOps(WORKOUT, plan.ops)
    expect(after.length).toBeGreaterThanOrEqual(1)
    expect(after.filter(i => i.exercise.category === 'skill').every(i => i.sets >= 2)).toBe(true)
  })

  it('não mexe quando já cabe', () => {
    const plan = fitWorkoutToMinutes(WORKOUT, 60)
    expect(plan.ops).toEqual([])
    expect(plan.preview[0]).toMatch(/já cabe/)
  })
})

describe('aliviar', () => {
  it('leve tira uma série de tudo', () => {
    const after = applyOps(WORKOUT, lightenWorkout(WORKOUT, 'leve').ops)
    expect(after).toHaveLength(5)
    expect(after.every(i => i.sets === 2)).toBe(true)
  })

  it('forte também tira a força acessória', () => {
    const after = applyOps(WORKOUT, lightenWorkout(WORKOUT, 'forte').ops)
    expect(after.some(i => i.exercise.category === 'forca')).toBe(false)
  })

  it('depois de WOD de puxada tira a força das skills de puxada', () => {
    const after = applyOps(WORKOUT, lightenWorkout(WORKOUT, 'leve', true).ops)
    expect(after.some(i => i.exercise.category === 'forca')).toBe(false)
  })

  it('série única não vai a zero', () => {
    const one = [item(1, 'skill', 1)]
    expect(applyOps(one, lightenWorkout(one, 'forte').ops)[0].sets).toBe(1)
  })
})

describe('troca de exercício', () => {
  const current = WORKOUT[2].exercise
  const pool = [
    { ...current, id: 'same', level: 'iniciante' },
    { ...current, id: 'harder', level: 'intermediario' },
    { ...current, id: 'core', category: 'core' },
    { ...current, id: 'ring', equipment: ['argolas'] },
    { ...current, id: 'ex1' },
  ]

  it('mesma skill e categoria, sem repetir o que já está no treino, respeitando equipamento', () => {
    const ids = swapCandidates(current, pool, WORKOUT.map(i => i.skill_exercise_id), ['barra']).map(e => e.id)
    expect(ids).toEqual(['same'])
  })

  it('aceita um nível abaixo, preferindo o mesmo nível', () => {
    const mid = { ...current, level: 'intermediario' }
    const ids = swapCandidates(mid, [{ ...current, id: 'easy', level: 'iniciante' }, { ...current, id: 'mid', level: 'intermediario' }], []).map(e => e.id)
    expect(ids).toEqual(['mid', 'easy'])
  })

  it('a prévia mostra antes e depois', () => {
    const plan = swapPlan(WORKOUT[2], { ...pool[0], sets: 3, reps: 6, time_sec: null })
    expect(plan.ops[0]).toMatchObject({ type: 'replace', order_index: 3, skill_exercise_id: 'same' })
    expect(plan.preview).toHaveLength(2)
  })
})

describe('semana, saúde e box', () => {
  it('semana segue os dias e o foco', () => {
    const week = weekPlan([1, 3, 5], ['pull-up', 'c2b', 't2b'], 'c2b')
    expect(week.filter(d => d.training).map(d => d.dow)).toEqual([1, 3, 5])
    expect(week[1].skills).toContain('c2b')
    expect(week[0].skills).toEqual([])
  })

  it('classifica urgência e lesão', () => {
    expect(detectHealthConcern('senti uma dor no peito no WOD')).toBe('emergency')
    expect(detectHealthConcern('to com falta de ar até agora')).toBe('emergency')
    expect(detectHealthConcern('meu ombro está incomodando')).toBe('injury')
    expect(detectHealthConcern('tenho dor no punho')).toBe('injury')
    expect(detectHealthConcern('quanto falta pro muscle-up?')).toBeNull()
    expect(detectHealthConcern('condor')).toBeNull()
  })

  it('recomenda aliviar depois de treino pesado na box', () => {
    expect(boxRecommendation([])).toBe('none')
    expect(boxRecommendation([{ intensity: 3, stimulus: ['puxada'] }])).toBe('none')
    expect(boxRecommendation([{ intensity: 5, stimulus: ['pernas'] }])).toBe('lighten')
    expect(boxRecommendation([{ intensity: 4, stimulus: ['puxada', 'core'] }])).toBe('lighten_pulling')
  })
})

describe('definições das ferramentas', () => {
  it('nomes únicos, descrição e schema em todas', () => {
    const names = COACH_TOOLS.map(t => t.name)
    expect(new Set(names).size).toBe(names.length)
    for (const t of toolsForApi()) {
      expect(t.description.length).toBeGreaterThan(20)
      expect(t.input_schema.type).toBe('object')
      expect(t).not.toHaveProperty('kind')
    }
  })

  it('separa leitura de escrita', () => {
    expect(isWriteTool('get_today_workout')).toBe(false)
    expect(isWriteTool('fit_workout_to_time')).toBe(true)
    expect(isWriteTool('inexistente')).toBe(false)
  })
})
