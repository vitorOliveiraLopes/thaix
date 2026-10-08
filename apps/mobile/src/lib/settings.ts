import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Linking } from 'react-native';

import type { NotificationSettings, Preferences } from './account';
import { qk } from './query';
import { supabase } from './supabase';

export const SUPPORT_WHATSAPP = '5524998315673';

export function openWhatsApp(text?: string) {
  const url = `https://wa.me/${SUPPORT_WHATSAPP}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  return Linking.openURL(url);
}

/** Grava um pedaço de user_settings e recarrega a conta. */
export function useUpdateSettings(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { notifications?: NotificationSettings; preferences?: Preferences }) => {
      const { error } = await supabase.from('user_settings').update(patch).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.account(userId) }),
  });
}

/** Rotina (dias, tempo, equipamento): grava em onboarding_responses e recalcula o dia. */
export function useUpdateRoutine(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { dias_semana: number[]; session_minutes: number; equipment: string[] }) => {
      const { error } = await supabase
        .from('onboarding_responses')
        .update({ ...patch, frequencia: patch.dias_semana.length })
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.onboarding(userId) });
      client.invalidateQueries({ queryKey: ['today-workouts', userId] });
    },
  });
}
