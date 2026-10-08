/**
 * ThaixSkill — Catálogo do domínio
 *
 * Nomes, ícones e opções que aparecem em mais de uma tela (e que o agente
 * coach também vai usar). Mudou aqui, muda no app inteiro.
 */

import type { Protocol } from './business-rules'

// ─── Skills ───────────────────────────────────────────────────────────────────

/** IDs válidos na tabela `skills` (FK de user_skill_progress). */
export const SKILL_IDS = ['pull-up', 'c2b', 'bmu', 't2b', 'hspu'] as const
export type SkillId = (typeof SKILL_IDS)[number]

export function isSkillId(value: string): value is SkillId {
  return (SKILL_IDS as readonly string[]).includes(value)
}

export const SKILLS: Record<SkillId, { name: string; shortName: string; icon: string; description: string }> = {
  'pull-up': { name: 'Pull-up', shortName: 'Pull-up', icon: '🏋️', description: 'Strict, kipping ou butterfly' },
  c2b: { name: 'Chest to Bar', shortName: 'C2B', icon: '💥', description: 'Puxada com peito na barra' },
  bmu: { name: 'Bar Muscle-up', shortName: 'BMU', icon: '🥇', description: 'Transição acima da barra' },
  t2b: { name: 'Toes-to-Bar', shortName: 'T2B', icon: '✨', description: 'Pés na barra, core e quadril' },
  hspu: { name: 'HSPU', shortName: 'HSPU', icon: '🤸', description: 'Handstand push-up, força invertida' },
}

export function skillName(id: string): string {
  return isSkillId(id) ? SKILLS[id].name : id
}

export function skillIcon(id: string): string {
  return isSkillId(id) ? SKILLS[id].icon : '⭐'
}

// ─── Níveis ───────────────────────────────────────────────────────────────────

export const LEVEL_LABELS: Record<Protocol, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
}

/**
 * Nível inicial de cada skill a partir do teste físico do onboarding.
 * Regra própria (mais conservadora que recommendProtocol), igual à da web.
 */
export function initialSkillLevel(pushups: number, pullups: number): Protocol {
  if (pushups >= 20 && pullups >= 5) return 'avancado'
  if (pushups >= 15 && pullups >= 3) return 'intermediario'
  return 'iniciante'
}

// ─── Esforço percebido do exercício (1 a 5) ───────────────────────────────────

export const EXERCISE_EFFORT_LABELS: Record<number, string> = {
  1: 'Muito fácil',
  2: 'Fácil',
  3: 'Na medida',
  4: 'Difícil',
  5: 'Muito difícil',
}

// ─── Esforço do dia (0 a 10) ──────────────────────────────────────────────────

export const DAILY_EFFORT_SCALE: { label: string; emoji: string }[] = [
  { label: 'Sem esforço', emoji: '😄' },
  { label: 'Quase nada', emoji: '🙂' },
  { label: 'Muito leve', emoji: '😊' },
  { label: 'Leve', emoji: '😐' },
  { label: 'Moderado', emoji: '😕' },
  { label: 'Médio', emoji: '😣' },
  { label: 'Intenso', emoji: '😖' },
  { label: 'Forte', emoji: '😫' },
  { label: 'Muito forte', emoji: '😤' },
  { label: 'Severo', emoji: '🤯' },
  { label: 'Máximo esforço', emoji: '💀' },
]

// ─── Rotina do aluno ──────────────────────────────────────────────────────────

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

export const MIN_TRAINING_DAYS = 2

/** Minutos disponíveis por sessão (pergunta do onboarding). */
export const SESSION_MINUTES_OPTIONS = [20, 30, 45, 60] as const
export type SessionMinutes = (typeof SESSION_MINUTES_OPTIONS)[number]

/** Equipamento disponível (múltipla escolha no onboarding). */
export const EQUIPMENT_OPTIONS = [
  { id: 'barra', label: 'Barra fixa', icon: '➖' },
  { id: 'paralelas', label: 'Paralelas', icon: '🟰' },
  { id: 'argolas', label: 'Argolas', icon: '⭕' },
  { id: 'caixa', label: 'Caixa ou banco', icon: '📦' },
  { id: 'chao', label: 'Só o chão', icon: '🧘' },
] as const
export type EquipmentId = (typeof EQUIPMENT_OPTIONS)[number]['id']

export const HYDRATION_GOAL_OPTIONS_ML = [1000, 1500, 2000, 2500, 3000, 3500] as const

export function formatMl(ml: number): string {
  return ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

/** Ordem das telas. `current_step` em onboarding_responses guarda uma destas. */
export const ONBOARDING_STEPS = [
  'apresentacao',
  'motivacao',
  'como-conheceu',
  'skills',
  'trava',
  'teste-fisico',
  'frequencia',
  'protocolo',
] as const
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]
export const ONBOARDING_DONE = 'completo'

/** Converte o valor salvo no banco na tela onde o aluno deve retomar. */
export function resumeStep(saved: string | null | undefined): OnboardingStep {
  if (saved && (ONBOARDING_STEPS as readonly string[]).includes(saved)) return saved as OnboardingStep
  // 'peso' existia na web mas saiu do fluxo; quem parou nela segue para o resumo.
  if (saved === 'peso') return 'protocolo'
  return 'apresentacao'
}

export function nextOnboardingStep(step: OnboardingStep): OnboardingStep | typeof ONBOARDING_DONE {
  const i = ONBOARDING_STEPS.indexOf(step)
  return ONBOARDING_STEPS[i + 1] ?? ONBOARDING_DONE
}
