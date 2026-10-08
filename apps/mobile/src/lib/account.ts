import { ONBOARDING_DONE, isTrialExpired } from '@thaix/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuth } from './auth';
import { qk } from './query';
import { supabase } from './supabase';

export type NotificationSettings = {
  workout: { time: string; enabled: boolean };
  hydration: { time: string; enabled: boolean };
};

export type Preferences = {
  theme: 'light' | 'dark' | 'system';
  weightUnit: 'kg' | 'lb';
};

export type Account = {
  userId: string;
  email: string | null;
  profile: {
    name: string | null;
    weight_kg: number | null;
    height_cm: number | null;
    hydration_goal_ml: number | null;
  };
  onboardingStep: string | null;
  onboardingDone: boolean;
  settings: {
    subscription_status: string | null;
    subscription_plan: string | null;
    trial_ends_at: string | null;
    notifications: NotificationSettings;
    preferences: Preferences;
  } | null;
  trialExpired: boolean;
};

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  workout: { time: '07:30', enabled: true },
  hydration: { time: '14:00', enabled: true },
};

export const DEFAULT_PREFERENCES: Preferences = { theme: 'system', weightUnit: 'kg' };

async function fetchAccount(userId: string, email: string | null): Promise<Account> {
  const [profileRes, onboardingRes, settingsRes] = await Promise.all([
    supabase.from('profiles').select('name, weight_kg, height_cm, hydration_goal_ml').eq('user_id', userId).maybeSingle(),
    supabase.from('onboarding_responses').select('current_step').eq('user_id', userId).maybeSingle(),
    supabase
      .from('user_settings')
      .select('subscription_status, subscription_plan, trial_ends_at, notifications, preferences')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const failed = profileRes.error ?? onboardingRes.error ?? settingsRes.error;
  if (failed) throw new Error(failed.message);

  const step = (onboardingRes.data?.current_step as string | null) ?? null;
  const rawSettings = settingsRes.data;
  const settings = rawSettings
    ? {
        subscription_status: rawSettings.subscription_status ?? null,
        subscription_plan: rawSettings.subscription_plan ?? null,
        trial_ends_at: rawSettings.trial_ends_at ?? null,
        notifications: { ...DEFAULT_NOTIFICATIONS, ...(rawSettings.notifications ?? {}) },
        preferences: { ...DEFAULT_PREFERENCES, ...(rawSettings.preferences ?? {}) },
      }
    : null;

  return {
    userId,
    email,
    profile: {
      name: profileRes.data?.name ?? null,
      weight_kg: profileRes.data?.weight_kg ?? null,
      height_cm: profileRes.data?.height_cm ?? null,
      hydration_goal_ml: profileRes.data?.hydration_goal_ml ?? null,
    },
    onboardingStep: step,
    onboardingDone: step === ONBOARDING_DONE,
    settings,
    trialExpired: isTrialExpired(settings),
  };
}

/** Conta do aluno logado: perfil, etapa do onboarding e assinatura. */
export function useAccount() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: qk.account(userId ?? 'anon'),
    queryFn: () => fetchAccount(userId!, session?.user.email ?? null),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

/** Id do aluno logado. As telas protegidas só montam com sessão, então não é nulo nelas. */
export function useUserId(): string {
  const { session } = useAuth();
  if (!session) throw new Error('useUserId usado fora de uma tela protegida.');
  return session.user.id;
}

export function useRefreshAccount() {
  const client = useQueryClient();
  const userId = useAuth().session?.user.id;
  return useCallback(() => {
    if (userId) return client.invalidateQueries({ queryKey: qk.account(userId) });
  }, [client, userId]);
}
