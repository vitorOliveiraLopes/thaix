'use client'

import { createClient } from '@/lib/supabase/client'
import { recommendProtocol } from '@/lib/onboarding'

// Salva campos incrementais em onboarding_responses via upsert
async function upsertOnboarding(userId: string, fields: Record<string, unknown>) {
  const supabase = createClient()
  const { error } = await supabase
    .from('onboarding_responses')
    .upsert({ user_id: userId, ...fields }, { onConflict: 'user_id' })
  if (error) console.error('[onboarding_responses]', error)
}

// Salva campos no profiles
async function upsertProfile(userId: string, fields: Record<string, unknown>) {
  const supabase = createClient()
  const { error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('user_id', userId)
  if (error) console.error('[profiles]', error)
}

// Salva horários de notificação em user_settings
async function upsertSettings(userId: string, workoutTime: string, hydrationTime: string) {
  const supabase = createClient()
  const { data: existing } = await supabase
    .from('user_settings')
    .select('notifications')
    .eq('user_id', userId)
    .single()

  const notifications = {
    workout: { time: workoutTime, enabled: true },
    hydration: { time: hydrationTime, enabled: true },
  }

  await supabase
    .from('user_settings')
    .update({ notifications })
    .eq('user_id', userId)
}

// ── Funções exportadas por step ──────────────────────────────────────

export async function saveMotivacao(userId: string, motivacao: string) {
  await upsertOnboarding(userId, { motivacao })
}

export async function saveComoConheceu(userId: string, como_conheceu: string) {
  await upsertOnboarding(userId, { objetivo: como_conheceu })
}

export async function saveSkills(userId: string, skills: string[]) {
  await upsertOnboarding(userId, { skills })
}

export async function saveTrava(userId: string, trava: string) {
  await upsertOnboarding(userId, { trava })
}

export async function saveTesteFisico(
  userId: string,
  pushups: number,
  pullups: number,
  squats: number
) {
  const protocol = recommendProtocol({ pushups, pullups, squats })
  await upsertOnboarding(userId, {
    pushups,
    pullups,
    squats,
    protocol_recommended: protocol,
  })
  return protocol
}

export async function saveFrequencia(userId: string, frequencia: number, dias: number[]) {
  await upsertOnboarding(userId, { frequencia, dias_semana: dias })
}

export async function savePesoAltura(userId: string, weight_kg: number, height_cm: number) {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  await Promise.all([
    // Salva no perfil (usado para cálculos)
    supabase
      .from('profiles')
      .update({ weight_kg, height_cm })
      .eq('user_id', userId),

    // ✅ Cria o primeiro registro no histórico de peso
    supabase
      .from('weight_logs')
      .upsert(
        { user_id: userId, date: today, weight_kg },
        { onConflict: 'user_id,date' }
      ),
  ])
}

export async function saveHorarios(
  userId: string,
  workoutTime: string,
  hydrationTime: string
) {
  await upsertSettings(userId, workoutTime, hydrationTime)
}

export async function markOnboardingComplete(userId: string) {
  await upsertOnboarding(userId, { completed_at: new Date().toISOString() })
}

// Busca o protocolo recomendado salvo no banco
export async function getRecommendedProtocol(userId: string): Promise<string> {
  const supabase = createClient()
  const { data } = await supabase
    .from('onboarding_responses')
    .select('protocol_recommended')
    .eq('user_id', userId)
    .single()
  return data?.protocol_recommended ?? 'iniciante'
}

export async function saveCurrentStep(userId: string, step: string) {
  const supabase = createClient()
  await supabase
    .from('onboarding_responses')
    .upsert({ user_id: userId, current_step: step }, { onConflict: 'user_id' })
}