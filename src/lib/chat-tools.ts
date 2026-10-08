/**
 * ThaixSkill — Definições de ferramentas do chat conversacional
 *
 * Cada ferramenta é uma ação estruturada que o Claude pode PROPOR (nunca
 * executar diretamente). O fluxo é sempre: Claude propõe → salvamos como
 * pendente → aluno confirma na tela → só então gravamos no banco.
 */

// ─── Ferramentas expostas ao Claude (schema JSON) ────────────────────────────

export const CHAT_TOOLS = [
  {
    name: 'register_hydration',
    description:
      'Marca a meta de hidratação do dia como cumprida. Use quando o aluno ' +
      'disser que já bebeu água suficiente hoje ou pedir para registrar hidratação.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'register_daily_effort',
    description:
      'Registra o esforço percebido do dia (escala 1 a 10), o mesmo dado ' +
      'usado na tela "Como você se sentiu". Use quando o aluno descrever ' +
      'como está se sentindo fisicamente hoje, de forma geral (não de um ' +
      'exercício específico do treino).',
    input_schema: {
      type: 'object',
      properties: {
        score: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Nível de esforço/cansaço percebido pelo aluno, de 1 (leve) a 10 (extremo)',
        },
      },
      required: ['score'],
    },
  },
  {
    name: 'update_weight',
    description:
      'Atualiza o peso corporal do aluno no perfil. Use quando o aluno ' +
      'informar seu peso atual.',
    input_schema: {
      type: 'object',
      properties: {
        weight_kg: {
          type: 'number',
          description: 'Peso em quilogramas',
        },
      },
      required: ['weight_kg'],
    },
  },
  {
    name: 'register_pr_manual',
    description:
      'Registra um recorde pessoal (PR) manualmente para um exercício. Use ' +
      'quando o aluno mencionar ter batido um recorde fora de um treino ' +
      'estruturado do app (ex: "consegui fazer 10 pull-ups hoje na box").',
    input_schema: {
      type: 'object',
      properties: {
        exercise_name: {
          type: 'string',
          description: 'Nome do exercício como o aluno mencionou (ex: "pull-up strict", "HSPU")',
        },
        value: {
          type: 'number',
          description: 'Valor do recorde — número de repetições ou segundos',
        },
        unit: {
          type: 'string',
          enum: ['reps', 'seconds'],
          description: 'Unidade do valor: reps para repetições, seconds para tempo',
        },
      },
      required: ['exercise_name', 'value', 'unit'],
    },
  },
] as const

export type ChatToolName = (typeof CHAT_TOOLS)[number]['name']

// ─── System prompt ────────────────────────────────────────────────────────────
//
// Monta o prompt de sistema com o contexto completo do aluno. Os guardrails
// ficam fixos no início — nunca variam por aluno.

export type StudentContext = {
  name: string | null
  skills: Array<{
    skillName: string
    level: string
    weekNumber: number
    sessionsAtCurrentLevel: number
  }>
  recentAvgEffort: number | null
  recentPRs: Array<{ exerciseName: string; value: number; unit: string; date: string }>
  todayWorkouts: Array<{
    skillName: string
    completed: boolean
    exercises: string[]
  }>
  trainingDays: number[]
}

const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export function buildSystemPrompt(ctx: StudentContext): string {
  const skillsSummary = ctx.skills
    .map(s => `- ${s.skillName}: nível ${s.level}, semana ${s.weekNumber} (${s.sessionsAtCurrentLevel} sessões neste nível)`)
    .join('\n')

  const prsSummary = ctx.recentPRs.length > 0
    ? ctx.recentPRs.map(pr => `- ${pr.exerciseName}: ${pr.value} ${pr.unit === 'reps' ? 'reps' : 'segundos'} (${pr.date})`).join('\n')
    : '- nenhum PR recente registrado'

  const todaySummary = ctx.todayWorkouts.length > 0
    ? ctx.todayWorkouts
        .map(w => `- ${w.skillName}: ${w.completed ? 'concluído' : 'pendente'} (${w.exercises.join(', ')})`)
        .join('\n')
    : '- nenhum treino gerado para hoje ainda'

  const trainingDaysSummary = ctx.trainingDays.length > 0
    ? ctx.trainingDays.map(d => WEEKDAY_NAMES[d]).join(', ')
    : 'não configurado'

  return `Você é o assistente do ThaixSkill, um app de treino de skills de CrossFit \
(pull-up, chest-to-bar, bar muscle-up, toes-to-bar e HSPU) criado pela Coach Thaix. \
Você conversa com ${ctx.name ?? 'o aluno'} de forma direta, encorajadora e sem enrolação.

## Seu escopo
Você ajuda com dúvidas sobre: técnica dos exercícios do app, progressão de carga/nível, \
descanso entre séries e sessões, como avaliar o próprio esforço, e explicações sobre o \
funcionamento do app (progressão de nível, PRs, streak, etc).

## Regras que você NUNCA quebra
1. Você NUNCA diagnostica, avalia ou opina sobre dor, lesão ou desconforto físico real. \
Se o aluno mencionar dor, lesão, ou qualquer sintoma físico preocupante, oriente-o a \
procurar um médico ou fisioterapeuta antes de continuar treinando, e não dê conselho \
técnico sobre como "treinar apesar da dor".
2. Você NUNCA contradiz ou substitui a programação de treino que já está no app. Se o \
aluno perguntar "posso fazer outro treino em vez desse", explique o raciocínio por trás \
da programação atual, mas não invente um treino alternativo.
3. Se a pergunta for sobre outro assunto que não seja CrossFit, skills, treino ou o \
próprio app, redirecione educadamente de volta ao seu escopo.
4. Você NUNCA executa uma ação (registrar hidratação, esforço, peso, PR) sem que o \
aluno tenha claramente pedido ou confirmado a intenção. Se usar uma ferramenta, o \
sistema vai pedir confirmação ao aluno antes de gravar — você não precisa pedir de \
novo, mas deixe claro na sua resposta o que está prestes a ser registrado.
5. Concluir um treino (marcar exercícios/séries como feitos) NÃO é algo que você pode \
fazer — isso só acontece pela tela de treino do próprio app. Se o aluno tentar concluir \
um treino pelo chat, explique isso e direcione para a tela de treino.

## Contexto atual deste aluno

**Skills em progresso:**
${skillsSummary || '- nenhuma skill iniciada ainda'}

**Esforço médio recente:** ${ctx.recentAvgEffort !== null ? `${ctx.recentAvgEffort.toFixed(1)}/5` : 'sem dados recentes'}

**PRs recentes:**
${prsSummary}

**Treinos de hoje:**
${todaySummary}

**Dias de treino configurados:** ${trainingDaysSummary}

Use esse contexto para dar respostas específicas e pessoais, não genéricas. Por exemplo, \
se o esforço médio estiver alto, mencione isso ao falar sobre descanso. Se o aluno estiver \
perto de subir de nível numa skill, você pode mencionar isso quando relevante.`
}
