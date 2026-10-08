/**
 * ThaixSkill — Execução das ações do chat
 *
 * Estas funções SÓ são chamadas depois que o aluno confirma a ação na
 * tela — nunca a partir da resposta do Claude diretamente. Cada uma
 * recebe o client autenticado (RLS) e os parâmetros já validados.
 */

import type { ChatToolName } from './chat-tools'

type ActionResult = { success: boolean; message: string }

// ─── Resumo amigável (mostrado no card de confirmação, antes de gravar) ──────

export function buildActionSummary(toolName: ChatToolName, params: any): string {
  switch (toolName) {
    case 'register_hydration':
      return 'Marcar a meta de hidratação de hoje como cumprida'

    case 'register_daily_effort':
      return `Registrar esforço percebido de hoje: ${params.score}/10`

    case 'update_weight':
      return `Atualizar peso para ${params.weight_kg} kg`

    case 'register_pr_manual':
      return `Registrar PR: ${params.exercise_name} — ${params.value} ${
        params.unit === 'reps' ? 'reps' : 'segundos'
      }`

    default:
      return 'Ação desconhecida'
  }
}

// ─── Execução (chamada só após confirmação do aluno) ─────────────────────────

export async function executeAction(
  admin: any, // authClient — RLS garante escrita só nos próprios dados
  userId: string,
  toolName: ChatToolName,
  params: any
): Promise<ActionResult> {
  switch (toolName) {
    case 'register_hydration':
      return registerHydration(admin, userId)

    case 'register_daily_effort':
      return registerDailyEffort(admin, userId, params.score)

    case 'update_weight':
      return updateWeight(admin, userId, params.weight_kg)

    case 'register_pr_manual':
      return registerPRManual(admin, userId, params.exercise_name, params.value, params.unit)

    default:
      return { success: false, message: 'Ação não reconhecida.' }
  }
}

// ─── Implementações ───────────────────────────────────────────────────────────

async function registerHydration(admin: any, userId: string): Promise<ActionResult> {
  const today = new Date().toISOString().split('T')[0]

  const { error } = await admin
    .from('hydration_days')
    .upsert(
      { user_id: userId, date: today, met_goal: true },
      { onConflict: 'user_id,date' }
    )

  if (error) return { success: false, message: `Não consegui registrar a hidratação: ${error.message}` }
  return { success: true, message: 'Hidratação de hoje registrada! 💧' }
}

async function registerDailyEffort(admin: any, userId: string, score: number): Promise<ActionResult> {
  if (score < 1 || score > 10) {
    return { success: false, message: 'O esforço precisa estar entre 1 e 10.' }
  }

  const today = new Date().toISOString().split('T')[0]

  const { error } = await admin
    .from('daily_pain_logs')
    .upsert(
      { user_id: userId, date: today, pain_score: score },
      { onConflict: 'user_id,date' }
    )

  if (error) return { success: false, message: `Não consegui registrar o esforço: ${error.message}` }
  return { success: true, message: `Esforço de hoje registrado: ${score}/10.` }
}

async function updateWeight(admin: any, userId: string, weightKg: number): Promise<ActionResult> {
  if (weightKg <= 0 || weightKg > 400) {
    return { success: false, message: 'Esse valor de peso não parece correto — confere e tenta de novo?' }
  }

  const { error } = await admin
    .from('profiles')
    .update({ weight_kg: weightKg, updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  if (error) return { success: false, message: `Não consegui atualizar seu peso: ${error.message}` }
  return { success: true, message: `Peso atualizado para ${weightKg}kg.` }
}

async function registerPRManual(
  admin: any,
  userId: string,
  exerciseName: string,
  value: number,
  unit: 'reps' | 'seconds'
): Promise<ActionResult> {
  // Busca o exercício por nome aproximado — o aluno digita livremente,
  // então usamos ilike para encontrar o exercise_id real.
  const { data: matches } = await admin
    .from('skill_exercises')
    .select('id, exercise_name')
    .ilike('exercise_name', `%${exerciseName}%`)
    .limit(1)

  if (!matches || matches.length === 0) {
    return {
      success: false,
      message: `Não encontrei o exercício "${exerciseName}" no app. Pode conferir o nome exato?`,
    }
  }

  const exerciseId = matches[0].id
  const today = new Date().toISOString().split('T')[0]

  const { error } = await admin.from('pr_entries').insert({
    user_id:     userId,
    exercise_id: exerciseId,
    value,
    unit,
    date:        today,
    notes:       'Registrado via chat',
  })

  if (error) return { success: false, message: `Não consegui registrar o PR: ${error.message}` }
  return {
    success: true,
    message: `PR registrado: ${matches[0].exercise_name} — ${value} ${unit === 'reps' ? 'reps' : 'segundos'} 🏆`,
  }
}
