import {
  ONBOARDING_DONE,
  initialSkillLevel,
  isSkillId,
  recommendProtocol,
  toLocalISODate,
  type OnboardingStep,
} from '@thaix/core';
import { useQuery } from '@tanstack/react-query';

import type { NotificationSettings } from './account';
import { qk } from './query';
import { supabase } from './supabase';

export type OnboardingAnswers = {
  motivacao: string | null;
  objetivo: string | null; // coluna usada para "como conheceu"
  skills: string[] | null;
  trava: string | null;
  pushups: number | null;
  pullups: number | null;
  squats: number | null;
  frequencia: number | null;
  dias_semana: number[] | null;
  session_minutes: number | null;
  equipment: string[] | null;
  focus_skill_id?: string | null;
  protocol_recommended: string | null;
  current_step: string | null;
};

// '*' em vez de lista: colunas novas (ex.: focus_skill_id) não quebram a leitura
// enquanto o SQL correspondente ainda não rodou no Supabase.
const ANSWERS_SELECT = '*';

async function fetchAnswers(userId: string): Promise<OnboardingAnswers | null> {
  const { data, error } = await supabase.from('onboarding_responses').select(ANSWERS_SELECT).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as OnboardingAnswers | null;
}

/** Respostas já salvas, para pré-preencher cada tela ao voltar ou retomar. */
export function useOnboardingAnswers(userId: string) {
  return useQuery({ queryKey: qk.onboarding(userId), queryFn: () => fetchAnswers(userId), staleTime: Infinity });
}

/**
 * Salva as respostas de uma tela e já marca a próxima etapa, numa única
 * escrita. Se o app fechar no meio, o aluno retoma da tela seguinte.
 */
export async function saveStep(
  userId: string,
  fields: Partial<Omit<OnboardingAnswers, 'current_step'>>,
  nextStep: OnboardingStep | typeof ONBOARDING_DONE,
): Promise<void> {
  const { error } = await supabase
    .from('onboarding_responses')
    .upsert({ user_id: userId, ...fields, current_step: nextStep }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

export async function saveTesteFisico(userId: string, pushups: number, pullups: number, squats: number, nextStep: OnboardingStep) {
  await saveStep(
    userId,
    { pushups, pullups, squats, protocol_recommended: recommendProtocol(pushups, pullups, squats) },
    nextStep,
  );
}

export async function saveNotificationTimes(userId: string, workoutTime: string, hydrationTime: string) {
  const notifications: NotificationSettings = {
    workout: { time: workoutTime, enabled: true },
    hydration: { time: hydrationTime, enabled: true },
  };
  const { error } = await supabase.from('user_settings').update({ notifications }).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function savePesoAltura(userId: string, weightKg: number, heightCm: number) {
  const [profileRes, logRes] = await Promise.all([
    supabase.from('profiles').update({ weight_kg: weightKg, height_cm: heightCm }).eq('user_id', userId),
    supabase.from('weight_logs').upsert({ user_id: userId, date: toLocalISODate(), weight_kg: weightKg }, { onConflict: 'user_id,date' }),
  ]);
  const failed = profileRes.error ?? logRes.error;
  if (failed) throw new Error(failed.message);
}

/**
 * Fecha o onboarding: cria o progresso de cada skill escolhida no nível
 * indicado pelo teste físico e marca a etapa como concluída.
 * O progresso vem antes da marcação: se falhar, o aluno continua no resumo.
 */
export async function completeOnboarding(userId: string): Promise<void> {
  const answers = await fetchAnswers(userId);
  const skills = (answers?.skills ?? []).filter(isSkillId);
  if (skills.length === 0) throw new Error('Escolha ao menos uma skill para continuar.');

  const level = initialSkillLevel(answers?.pushups ?? 0, answers?.pullups ?? 0);
  const now = new Date().toISOString();

  // ignoreDuplicates: refazer o onboarding não reseta o progresso de quem já treinava.
  const { error } = await supabase.from('user_skill_progress').upsert(
    skills.map((skill_id) => ({
      user_id: userId,
      skill_id,
      level,
      week_number: 1,
      sessions_at_current_level: 0,
      updated_at: now,
    })),
    { onConflict: 'user_id,skill_id', ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);

  const { error: doneError } = await supabase
    .from('onboarding_responses')
    .upsert({ user_id: userId, current_step: ONBOARDING_DONE, completed_at: now }, { onConflict: 'user_id' });
  if (doneError) throw new Error(doneError.message);
}
