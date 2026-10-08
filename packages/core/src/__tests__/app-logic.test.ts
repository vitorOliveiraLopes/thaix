import { describe, it, expect } from 'vitest'
import {
  initialSkillLevel,
  resumeStep,
  nextOnboardingStep,
  isSkillId,
  skillName,
  formatMl,
  toLocalISODate,
  daysBetween,
  calculateMaxStreak,
  linearTrend,
  nextTrainingDay,
  monthGrid,
  greeting,
  isTrialExpired,
  trialDaysLeft,
  emptySets,
  activeSetIndex,
  adjustSet,
  canAdvance,
  buildCompletionPayload,
  bestRecorded,
  formatClock,
} from '../index'

describe('catálogo', () => {
  it('nível inicial segue a regra do onboarding da web', () => {
    expect(initialSkillLevel(10, 0)).toBe('iniciante')
    expect(initialSkillLevel(15, 3)).toBe('intermediario')
    expect(initialSkillLevel(20, 5)).toBe('avancado')
    expect(initialSkillLevel(30, 2)).toBe('iniciante')
  })

  it('retoma o onboarding na tela salva', () => {
    expect(resumeStep(null)).toBe('apresentacao')
    expect(resumeStep('trava')).toBe('trava')
    expect(resumeStep('peso')).toBe('protocolo')
    expect(resumeStep('qualquer')).toBe('apresentacao')
  })

  it('avança pelas telas e termina em completo', () => {
    expect(nextOnboardingStep('apresentacao')).toBe('motivacao')
    expect(nextOnboardingStep('frequencia')).toBe('protocolo')
    expect(nextOnboardingStep('protocolo')).toBe('completo')
  })

  it('valida ids de skill e formata nomes', () => {
    expect(isSkillId('c2b')).toBe(true)
    expect(isSkillId('kipping')).toBe(false)
    expect(skillName('t2b')).toBe('Toes-to-Bar')
    expect(skillName('desconhecida')).toBe('desconhecida')
    expect(formatMl(2500)).toBe('2.5L')
    expect(formatMl(500)).toBe('500ml')
  })
})

describe('datas e progresso', () => {
  it('data local não vira o dia seguinte à noite', () => {
    expect(toLocalISODate(new Date(2026, 9, 8, 23, 30))).toBe('2026-10-08')
  })

  it('conta dias corridos', () => {
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2)
    expect(daysBetween('2026-10-08', '2026-10-08')).toBe(0)
  })

  it('maior sequência considera dias repetidos e buracos', () => {
    expect(calculateMaxStreak([])).toBe(0)
    expect(calculateMaxStreak(['2026-10-01', '2026-10-02', '2026-10-02', '2026-10-03', '2026-10-05'])).toBe(3)
  })

  it('tendência linear', () => {
    expect(linearTrend([8, 6, 4]).direction).toBe('down')
    expect(linearTrend([2, 4, 6]).direction).toBe('up')
    expect(linearTrend([5, 5, 5]).direction).toBe('flat')
    expect(linearTrend([5]).direction).toBe('flat')
  })

  it('próximo dia de treino dá a volta na semana', () => {
    expect(nextTrainingDay([1, 3, 5], 3)).toBe(5)
    expect(nextTrainingDay([1, 3, 5], 6)).toBe(1)
    expect(nextTrainingDay([], 2)).toBeNull()
  })

  it('grade do mês começa no dia da semana certo', () => {
    const grid = monthGrid(2026, 9) // outubro de 2026 começa numa quinta
    expect(grid.slice(0, 4)).toEqual([null, null, null, null])
    expect(grid[4]).toBe(1)
    expect(grid.filter(Boolean)).toHaveLength(31)
  })

  it('saudação pela hora', () => {
    expect(greeting(8, 'Ana Souza')).toBe('Bom dia, Ana')
    expect(greeting(14)).toBe('Boa tarde')
    expect(greeting(20, '')).toBe('Boa noite')
  })

  it('trial vencido só bloqueia quem está em trial', () => {
    const now = Date.parse('2026-10-08T12:00:00Z')
    expect(isTrialExpired({ subscription_status: 'trial', trial_ends_at: '2026-10-01T00:00:00Z' }, now)).toBe(true)
    expect(isTrialExpired({ subscription_status: 'active', trial_ends_at: '2026-10-01T00:00:00Z' }, now)).toBe(false)
    expect(isTrialExpired({ subscription_status: 'trial', trial_ends_at: '2026-10-20T00:00:00Z' }, now)).toBe(false)
    expect(isTrialExpired(null, now)).toBe(false)
    expect(trialDaysLeft('2026-10-10T12:00:00Z', now)).toBe(2)
    expect(trialDaysLeft('2026-10-01T00:00:00Z', now)).toBe(0)
  })
})

describe('sessão de treino', () => {
  it('séries começam vazias e a ativa é a primeira vazia', () => {
    const v = emptySets(3)
    expect(v).toEqual([null, null, null])
    expect(activeSetIndex(v)).toBe(0)
    expect(activeSetIndex([4, null, null])).toBe(1)
    expect(activeSetIndex([4, 5, 6])).toBe(-1)
  })

  it('ajuste nunca fica negativo e série preenchida continua editável', () => {
    expect(adjustSet([null], 0, -1)).toEqual([0])
    expect(adjustSet([5, null], 0, 1)).toEqual([6, null])
  })

  it('só avança com todas as séries e o esforço', () => {
    const base = { skill_exercise_id: 'a', reps_per_set: [5, 5, 5] }
    expect(canAdvance(base, 3, false)).toBe(false)
    expect(canAdvance({ ...base, perceived_effort: 3 }, 3, false)).toBe(true)
    expect(canAdvance({ ...base, reps_per_set: [5, null, 5], perceived_effort: 3 }, 3, false)).toBe(false)
    expect(canAdvance({ skill_exercise_id: 'b', time_per_set: [20], perceived_effort: 2 }, 1, true)).toBe(true)
  })

  it('melhor série registrada', () => {
    expect(bestRecorded([null, null])).toBeUndefined()
    expect(bestRecorded([0, null])).toBe(0)
    expect(bestRecorded([3, 7, 5])).toBe(7)
  })

  it('payload tem um item por exercício e fica com o maior esforço', () => {
    const payload = buildCompletionPayload([
      { skill_exercise_id: 'a', reps_per_set: [5, 6], perceived_effort: 2 },
      { skill_exercise_id: 'b', time_per_set: [20, 25], perceived_effort: 3 },
      { skill_exercise_id: 'a', reps_per_set: [4, 4], perceived_effort: 4 },
      { skill_exercise_id: 'c', reps_per_set: [1] },
    ])
    expect(payload).toHaveLength(2)
    const a = payload.find(p => p.skill_exercise_id === 'a')!
    expect(a.perceived_effort).toBe(4)
    expect(a.reps_achieved).toBe(4)
    expect(payload.find(p => p.skill_exercise_id === 'b')!.time_achieved_sec).toBe(25)
  })

  it('relógio mm:ss', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(75)).toBe('01:15')
  })
})
