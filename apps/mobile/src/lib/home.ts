import { calculateStreak, isRestDay, toLocalISODate } from '@thaix/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from './query';
import { supabase } from './supabase';
import { fetchTodayWorkouts, generateTodayWorkouts, type Workout } from './workouts';

// ─── Resumo do dia (sequência, água, esforço) ─────────────────────────────────

export type HomeStats = {
  streak: number;
  hydrationMet: boolean;
  hydrationGoalMl: number;
  effortToday: number | null;
};

async function fetchHomeStats(userId: string): Promise<HomeStats> {
  const today = toLocalISODate();
  const [workoutsRes, hydrationRes, painRes, profileRes] = await Promise.all([
    supabase
      .from('daily_workouts')
      .select('date')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('date', { ascending: false })
      .limit(120),
    supabase.from('hydration_days').select('met_goal').eq('user_id', userId).eq('date', today).maybeSingle(),
    supabase.from('daily_pain_logs').select('pain_score').eq('user_id', userId).eq('date', today).maybeSingle(),
    supabase.from('profiles').select('hydration_goal_ml').eq('user_id', userId).maybeSingle(),
  ]);

  return {
    streak: calculateStreak((workoutsRes.data ?? []).map((w) => w.date as string), today),
    hydrationMet: hydrationRes.data?.met_goal ?? false,
    hydrationGoalMl: profileRes.data?.hydration_goal_ml ?? 2000,
    effortToday: painRes.data?.pain_score ?? null,
  };
}

export function useHomeStats(userId: string) {
  return useQuery({ queryKey: qk.home(userId), queryFn: () => fetchHomeStats(userId) });
}

/** Atualização otimista do resumo: a tela muda na hora e volta se o banco recusar. */
function useHomePatch(userId: string) {
  const client = useQueryClient();
  return {
    async apply(patch: Partial<HomeStats>) {
      await client.cancelQueries({ queryKey: qk.home(userId) });
      const previous = client.getQueryData<HomeStats>(qk.home(userId));
      if (previous) client.setQueryData<HomeStats>(qk.home(userId), { ...previous, ...patch });
      return previous;
    },
    rollback(previous: HomeStats | undefined) {
      if (previous) client.setQueryData(qk.home(userId), previous);
    },
    settle() {
      client.invalidateQueries({ queryKey: qk.home(userId) });
      client.invalidateQueries({ queryKey: qk.progress(userId) });
    },
  };
}

export function useToggleHydration(userId: string) {
  const patch = useHomePatch(userId);
  return useMutation({
    mutationFn: async (metGoal: boolean) => {
      const { error } = await supabase
        .from('hydration_days')
        .upsert({ user_id: userId, date: toLocalISODate(), met_goal: metGoal }, { onConflict: 'user_id,date' });
      if (error) throw new Error(error.message);
    },
    onMutate: (metGoal) => patch.apply({ hydrationMet: metGoal }),
    onError: (_e, _v, previous) => patch.rollback(previous),
    onSettled: () => patch.settle(),
  });
}

export function useSetHydrationGoal(userId: string) {
  const patch = useHomePatch(userId);
  return useMutation({
    mutationFn: async (ml: number) => {
      const { error } = await supabase.from('profiles').update({ hydration_goal_ml: ml }).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onMutate: (ml) => patch.apply({ hydrationGoalMl: ml }),
    onError: (_e, _v, previous) => patch.rollback(previous),
    onSettled: () => patch.settle(),
  });
}

export function useSaveDailyEffort(userId: string) {
  const patch = useHomePatch(userId);
  return useMutation({
    mutationFn: async (score: number) => {
      const { error } = await supabase
        .from('daily_pain_logs')
        .upsert({ user_id: userId, date: toLocalISODate(), pain_score: score }, { onConflict: 'user_id,date' });
      if (error) throw new Error(error.message);
    },
    onMutate: (score) => patch.apply({ effortToday: score }),
    onError: (_e, _v, previous) => patch.rollback(previous),
    onSettled: () => patch.settle(),
  });
}

// ─── Treinos do dia ───────────────────────────────────────────────────────────

export type TodayPlan = {
  workouts: Workout[];
  trainingDays: number[];
  /** Hoje não é dia de treino e ainda não há treino gerado. */
  restDay: boolean;
  /** Esforço médio (1 a 5) dos exercícios das últimas 3 sessões. */
  recentAvgEffort: number | null;
};

async function fetchRecentAvgEffort(userId: string): Promise<number | null> {
  const { data: recent } = await supabase
    .from('daily_workouts')
    .select('id')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })
    .limit(3);
  const ids = (recent ?? []).map((w) => w.id as string);
  if (ids.length === 0) return null;
  const { data } = await supabase.from('daily_workout_results').select('perceived_effort').in('daily_workout_id', ids);
  const efforts = (data ?? []).map((r) => (r.perceived_effort as number | null) ?? 3).filter((e) => e > 0);
  return efforts.length > 0 ? efforts.reduce((a, b) => a + b, 0) / efforts.length : null;
}

async function fetchTodayPlan(userId: string): Promise<TodayPlan> {
  const [{ data: onboarding }, recentAvgEffort] = await Promise.all([
    supabase.from('onboarding_responses').select('dias_semana').eq('user_id', userId).maybeSingle(),
    fetchRecentAvgEffort(userId),
  ]);
  const trainingDays = (onboarding?.dias_semana ?? []) as number[];

  if (isRestDay(trainingDays, new Date().getDay())) {
    // Em dia de descanso só mostramos treino se o aluno já escolheu treinar.
    const existing = await fetchTodayWorkouts(userId);
    return { workouts: existing, trainingDays, restDay: existing.length === 0, recentAvgEffort };
  }

  return { workouts: await generateTodayWorkouts(userId), trainingDays, restDay: false, recentAvgEffort };
}

export function useTodayPlan(userId: string) {
  const date = toLocalISODate();
  return useQuery({ queryKey: qk.todayWorkouts(userId, date), queryFn: () => fetchTodayPlan(userId) });
}

/** "Treinar mesmo assim" no dia de descanso. */
export function useTrainAnyway(userId: string) {
  const client = useQueryClient();
  const date = toLocalISODate();
  return useMutation({
    mutationFn: () => generateTodayWorkouts(userId),
    onSuccess: (workouts) => {
      client.setQueryData<TodayPlan>(qk.todayWorkouts(userId, date), (prev) => ({
        trainingDays: prev?.trainingDays ?? [],
        recentAvgEffort: prev?.recentAvgEffort ?? null,
        workouts,
        restDay: false,
      }));
    },
  });
}
