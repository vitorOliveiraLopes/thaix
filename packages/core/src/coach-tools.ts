/**
 * ThaixSkill — Ferramentas do agente coach
 *
 * Definições no formato da API de mensagens da Anthropic (tool use).
 * - kind 'read': a API executa na hora e devolve o resultado ao modelo.
 * - kind 'write': vira proposta com prévia; só grava quando o aluno confirma.
 * - kind 'display': mostra um card nativo no chat (ex.: lista de exercícios), sem gravar nada.
 */

import { BOX_KINDS, BOX_STIMULI } from './coach'
import { EQUIPMENT_OPTIONS, SESSION_MINUTES_OPTIONS, SKILL_IDS } from './catalog'

type JsonSchema = { type: 'object'; properties: Record<string, unknown>; required?: string[] }

export type CoachTool = {
  name: string
  kind: 'read' | 'write' | 'display'
  description: string
  input_schema: JsonSchema
}

const skillId = { type: 'string', enum: [...SKILL_IDS], description: 'Id da skill: pull-up, c2b, bmu, t2b ou hspu' }
const exerciseRef = {
  type: 'string',
  description: 'Nome (ou parte do nome) do exercício como aparece no treino de hoje, ou a posição dele no treino (ex.: "3").',
}

export const COACH_TOOLS = [
  // ─── Exibição ──────────────────────────────────────────────────────────────
  {
    name: 'show_today_workout',
    kind: 'display',
    description:
      'Mostra ao aluno, abaixo da sua mensagem, um card com os exercícios do treino de hoje (séries, reps/tempo e botão para abrir o treino). ' +
      'Use SEMPRE que for apresentar ou listar os exercícios de hoje, inclusive depois de um ajuste confirmado; não liste os exercícios no texto.',
    input_schema: { type: 'object', properties: { skill_id: { ...skillId, description: 'Só o treino desta skill (opcional; padrão: todos de hoje)' } } },
  },
  // ─── Leitura ───────────────────────────────────────────────────────────────
  {
    name: 'get_today_workout',
    kind: 'read',
    description: 'Detalhes do treino de hoje (descanso e observações de cada exercício). O resumo do treino já está no contexto: NÃO chame só para propor ajuste.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_week_overview',
    kind: 'read',
    description: 'A semana do aluno: dias de treino, quais skills caem em cada dia, o que já foi feito e o que foi perdido.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_progress_status',
    kind: 'read',
    description:
      'Situação de progressão de uma skill: nível, semana, sessões no nível e o desempenho nas duas últimas sessões em relação ao critério de subida. Use para responder "quanto falta para subir de nível".',
    input_schema: { type: 'object', properties: { skill_id: skillId }, required: ['skill_id'] },
  },
  {
    name: 'get_workout_history',
    kind: 'read',
    description: 'Últimos treinos concluídos (opcionalmente de uma skill) com o resultado de cada exercício e o esforço.',
    input_schema: {
      type: 'object',
      properties: { skill_id: skillId, limit: { type: 'integer', minimum: 1, maximum: 10, description: 'Quantos treinos (padrão 5)' } },
    },
  },
  {
    name: 'get_exercise_guide',
    kind: 'read',
    description:
      'Ficha de um exercício do app: categoria, nível, dose, descanso, dica da Coach Thaís, conteúdo da base de conhecimento e variações mais fáceis/difíceis. Use para dúvidas de execução, escalas e progressões.',
    input_schema: { type: 'object', properties: { exercise: { type: 'string', description: 'Nome ou parte do nome do exercício' } }, required: ['exercise'] },
  },
  {
    name: 'get_personal_records',
    kind: 'read',
    description: 'Melhores recordes pessoais do aluno, opcionalmente filtrando por nome de exercício.',
    input_schema: { type: 'object', properties: { exercise: { type: 'string' } } },
  },
  {
    name: 'get_box_log',
    kind: 'read',
    description: 'Treinos da box registrados nos últimos dias (tipo, intensidade, estímulo). Use para avaliar fadiga antes de recomendar o treino de skill.',
    input_schema: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 14, description: 'Janela em dias (padrão 7)' } } },
  },

  // ─── Ajustes no treino de hoje ─────────────────────────────────────────────
  {
    name: 'fit_workout_to_time',
    kind: 'write',
    description:
      'Encaixa o treino de hoje no tempo disponível: tira mobilidade/core/força acessória antes e preserva a skill; se precisar, reduz séries. Use quando o aluno disser quanto tempo tem hoje.',
    input_schema: {
      type: 'object',
      properties: {
        minutes: { type: 'integer', minimum: 5, maximum: 120, description: 'Minutos disponíveis hoje' },
        skill_id: { ...skillId, description: 'Skill do treino a ajustar, quando houver mais de um treino hoje' },
      },
      required: ['minutes'],
    },
  },
  {
    name: 'lighten_workout',
    kind: 'write',
    description:
      'Alivia o treino de hoje por cansaço ou treino pesado na box. "leve" tira uma série de cada exercício; "forte" também tira a força acessória. avoid_pulling=true tira a força das skills de puxada (ex.: WOD com muitos pull-ups).',
    input_schema: {
      type: 'object',
      properties: {
        intensity: { type: 'string', enum: ['leve', 'forte'] },
        avoid_pulling: { type: 'boolean' },
        reason: { type: 'string', description: 'Motivo em poucas palavras, para registro' },
        skill_id: skillId,
      },
      required: ['intensity'],
    },
  },
  {
    name: 'swap_exercise',
    kind: 'write',
    description:
      'Troca um exercício do treino de hoje por outro da mesma skill e categoria (mesmo nível ou mais fácil), que o aluno consegue fazer com o equipamento dele.',
    input_schema: {
      type: 'object',
      properties: {
        exercise: exerciseRef,
        reason: { type: 'string', enum: ['equipamento', 'desconforto', 'preferencia', 'mais_facil'] },
      },
      required: ['exercise', 'reason'],
    },
  },

  // ─── Rotina ────────────────────────────────────────────────────────────────
  {
    name: 'update_routine',
    kind: 'write',
    description: 'Muda a rotina do aluno: dias de treino (0=domingo … 6=sábado, mínimo 2), minutos por sessão e equipamento disponível. Envie só o que mudou.',
    input_schema: {
      type: 'object',
      properties: {
        training_days: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, minItems: 2, maxItems: 7 },
        session_minutes: { type: 'integer', enum: [...SESSION_MINUTES_OPTIONS] },
        equipment: { type: 'array', items: { type: 'string', enum: EQUIPMENT_OPTIONS.map(e => e.id) } },
      },
    },
  },
  {
    name: 'set_focus_skill',
    kind: 'write',
    description: 'Define a skill prioritária: ela passa a entrar em todos os dias de treino (respeitando as combinações seguras). "nenhuma" remove o foco.',
    input_schema: {
      type: 'object',
      properties: { skill_id: { type: 'string', enum: [...SKILL_IDS, 'nenhuma'] } },
      required: ['skill_id'],
    },
  },
  {
    name: 'add_skill',
    kind: 'write',
    description: 'Adiciona uma skill nova às trilhas do aluno, começando no nível indicado pelo teste físico.',
    input_schema: { type: 'object', properties: { skill_id: skillId }, required: ['skill_id'] },
  },
  {
    name: 'set_goal',
    kind: 'write',
    description: 'Registra um objetivo do aluno, com data opcional (ex.: "primeiro bar muscle-up até o Open", "5 C2B unbroken em 8 semanas").',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string', maxLength: 200 },
        skill_id: skillId,
        target_date: { type: 'string', description: 'Data alvo no formato AAAA-MM-DD' },
      },
      required: ['description'],
    },
  },

  // ─── Box e saúde ───────────────────────────────────────────────────────────
  {
    name: 'log_box_session',
    kind: 'write',
    description:
      'Registra um treino feito na box (fora do app): tipo, intensidade 1–5 e estímulos. Use quando o aluno contar o que fez na aula. Depois avalie se vale aliviar o treino de skill.',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: [...BOX_KINDS] },
        intensity: { type: 'integer', minimum: 1, maximum: 5 },
        stimulus: { type: 'array', items: { type: 'string', enum: [...BOX_STIMULI] } },
        notes: { type: 'string', maxLength: 300, description: 'Ex.: "Fran", "30 C2B + thrusters"' },
        date: { type: 'string', description: 'AAAA-MM-DD; padrão hoje' },
      },
      required: ['kind', 'intensity', 'stimulus'],
    },
  },
  {
    name: 'register_limitation',
    kind: 'write',
    description:
      'Registra uma limitação física que o aluno relatou (ex.: ombro incomodando). Não é diagnóstico: serve para o coach sugerir trocas e lembrar de procurar um profissional.',
    input_schema: {
      type: 'object',
      properties: { body_area: { type: 'string', maxLength: 60 }, description: { type: 'string', maxLength: 200 } },
      required: ['body_area', 'description'],
    },
  },
  {
    name: 'resolve_limitation',
    kind: 'write',
    description: 'Marca uma limitação registrada como resolvida quando o aluno disser que melhorou.',
    input_schema: { type: 'object', properties: { body_area: { type: 'string' } }, required: ['body_area'] },
  },

  // ─── Registros do dia ──────────────────────────────────────────────────────
  {
    name: 'register_hydration',
    kind: 'write',
    description: 'Marca a meta de água de hoje como cumprida.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'register_daily_effort',
    kind: 'write',
    description: 'Registra o esforço/cansaço geral do dia (0 a 10), o mesmo do card "Esforço" da tela inicial.',
    input_schema: { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 10 } }, required: ['score'] },
  },
  {
    name: 'update_weight',
    kind: 'write',
    description: 'Atualiza o peso corporal do aluno (kg).',
    input_schema: { type: 'object', properties: { weight_kg: { type: 'number', minimum: 25, maximum: 300 } }, required: ['weight_kg'] },
  },
  {
    name: 'register_pr',
    kind: 'write',
    description: 'Registra um recorde pessoal feito fora do app (ex.: "fiz 10 pull-ups seguidos na box"). Se o exercício não existir no app, grava com o nome informado.',
    input_schema: {
      type: 'object',
      properties: {
        exercise: { type: 'string' },
        value: { type: 'number', exclusiveMinimum: 0 },
        unit: { type: 'string', enum: ['reps', 'seconds', 'kg'] },
      },
      required: ['exercise', 'value', 'unit'],
    },
  },
] as const satisfies readonly CoachTool[]

export type CoachToolName = (typeof COACH_TOOLS)[number]['name']

const BY_NAME = new Map<string, CoachTool>(COACH_TOOLS.map(t => [t.name, t]))

export function isCoachTool(name: string): name is CoachToolName {
  return BY_NAME.has(name)
}

export function isWriteTool(name: string): boolean {
  return BY_NAME.get(name)?.kind === 'write'
}

export function isDisplayTool(name: string): boolean {
  return BY_NAME.get(name)?.kind === 'display'
}

/** Formato aceito pela API (sem o campo interno `kind`). */
export function toolsForApi() {
  return COACH_TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema }))
}
