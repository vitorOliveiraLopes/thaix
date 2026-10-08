import { calculateMaxStreak, calculateStreak, toLocalISODate } from '@thaix/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from './query';
import { supabase } from './supabase';

// ─── Visão geral ──────────────────────────────────────────────────────────────

export type ProgressOverview = {
  workoutDates: string[];
  totalWorkouts: number;
  currentStreak: number;
  maxStreak: number;
  hydrationDates: string[];
  effortLogs: { date: string; score: number }[];
};

export function useProgressOverview(userId: string) {
  return useQuery({
    queryKey: qk.progress(userId),
    queryFn: async (): Promise<ProgressOverview> => {
      const [workoutsRes, painRes, hydrationRes] = await Promise.all([
        supabase.from('daily_workouts').select('date').eq('user_id', userId).not('completed_at', 'is', null),
        supabase.from('daily_pain_logs').select('date, pain_score').eq('user_id', userId).order('date', { ascending: true }),
        supabase.from('hydration_days').select('date, met_goal').eq('user_id', userId).eq('met_goal', true),
      ]);
      const dates = (workoutsRes.data ?? []).map((w) => w.date as string);
      const unique = [...new Set(dates)];
      return {
        workoutDates: unique,
        totalWorkouts: dates.length,
        currentStreak: calculateStreak(unique, toLocalISODate()),
        maxStreak: calculateMaxStreak(unique),
        hydrationDates: (hydrationRes.data ?? []).map((h) => h.date as string),
        effortLogs: (painRes.data ?? []).map((p) => ({ date: p.date as string, score: p.pain_score as number })),
      };
    },
  });
}

export type SkillProgress = { skill_id: string; level: string; week_number: number; sessions_at_current_level: number };

export function useSkillProgress(userId: string) {
  return useQuery({
    queryKey: qk.skillProgress(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_skill_progress')
        .select('skill_id, level, week_number, sessions_at_current_level')
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
      return (data ?? []) as SkillProgress[];
    },
  });
}

// ─── Histórico de uma skill ───────────────────────────────────────────────────

export type HistoryItem = {
  exercise_name: string;
  sets: number;
  reps: number | null;
  time_sec: number | null;
  reps_achieved: number | null;
  time_achieved_sec: number | null;
  perceived_effort: number | null;
};

export type HistoryWorkout = { id: string; date: string; week_number: number; is_redo: boolean; items: HistoryItem[] };

export type SkillHistory = {
  workouts: HistoryWorkout[];
  levelChanges: { to_level: string; week_number: number; changed_at: string }[];
  progress: SkillProgress | null;
};

export function useSkillHistory(userId: string, skillId: string) {
  return useQuery({
    queryKey: qk.skillHistory(userId, skillId),
    queryFn: async (): Promise<SkillHistory> => {
      // Itens e resultados em duas consultas: o join de 3 níveis com a chave
      // composta de daily_workout_results volta vazio no PostgREST.
      const [workoutsRes, levelRes, progressRes] = await Promise.all([
        supabase
          .from('daily_workouts')
          .select('id, date, week_number, source_workout_id, daily_workout_items(sets, reps, time_sec, skill_exercise_id, order_index, skill_exercises(exercise_name))')
          .eq('user_id', userId)
          .eq('skill_id', skillId)
          .not('completed_at', 'is', null)
          .order('date', { ascending: false }),
        supabase
          .from('skill_level_history')
          .select('to_level, week_number, changed_at')
          .eq('user_id', userId)
          .eq('skill_id', skillId)
          .order('changed_at', { ascending: false }),
        supabase
          .from('user_skill_progress')
          .select('skill_id, level, week_number, sessions_at_current_level')
          .eq('user_id', userId)
          .eq('skill_id', skillId)
          .maybeSingle(),
      ]);
      if (workoutsRes.error) throw new Error(workoutsRes.error.message);

      type RawItem = { sets: number; reps: number | null; time_sec: number | null; skill_exercise_id: string; order_index: number; skill_exercises: { exercise_name: string } | null };
      const raw = (workoutsRes.data ?? []) as unknown as { id: string; date: string; week_number: number; source_workout_id: string | null; daily_workout_items: RawItem[] }[];

      const results = new Map<string, { reps_achieved: number | null; time_achieved_sec: number | null; perceived_effort: number | null }>();
      if (raw.length > 0) {
        const { data } = await supabase
          .from('daily_workout_results')
          .select('daily_workout_id, skill_exercise_id, reps_achieved, time_achieved_sec, perceived_effort')
          .in('daily_workout_id', raw.map((w) => w.id));
        for (const r of data ?? []) results.set(`${r.daily_workout_id}|${r.skill_exercise_id}`, r);
      }

      return {
        workouts: raw.map((w) => ({
          id: w.id,
          date: w.date,
          week_number: w.week_number,
          is_redo: !!w.source_workout_id,
          items: [...(w.daily_workout_items ?? [])]
            .sort((a, b) => a.order_index - b.order_index)
            .map((it) => {
              const r = results.get(`${w.id}|${it.skill_exercise_id}`);
              return {
                exercise_name: it.skill_exercises?.exercise_name ?? '',
                sets: it.sets,
                reps: it.reps,
                time_sec: it.time_sec,
                reps_achieved: r?.reps_achieved ?? null,
                time_achieved_sec: r?.time_achieved_sec ?? null,
                perceived_effort: r?.perceived_effort ?? null,
              };
            }),
        })),
        levelChanges: (levelRes.data ?? []) as SkillHistory['levelChanges'],
        progress: (progressRes.data as SkillProgress | null) ?? null,
      };
    },
  });
}

// ─── Recordes pessoais ────────────────────────────────────────────────────────

export type PR = { id: string; exercise_id: string; exercise_name: string; value: number; unit: string; date: string; notes: string | null; auto: boolean };
export type ExerciseOption = { id: string; exercise_name: string; skill_id: string };

export function usePRs(userId: string) {
  return useQuery({
    queryKey: qk.prs(userId),
    queryFn: async () => {
      const [prsRes, exercisesRes] = await Promise.all([
        supabase.from('pr_entries').select('id, exercise_id, value, unit, date, notes').eq('user_id', userId).order('date', { ascending: false }),
        supabase.from('skill_exercises').select('id, exercise_name, skill_id').order('skill_id').order('exercise_name'),
      ]);
      if (prsRes.error) throw new Error(prsRes.error.message);
      const exercises = (exercisesRes.data ?? []) as ExerciseOption[];
      const names = new Map(exercises.map((e) => [e.id, e.exercise_name]));
      const prs: PR[] = (prsRes.data ?? []).map((p) => ({
        id: p.id as string,
        exercise_id: p.exercise_id as string,
        exercise_name: names.get(p.exercise_id as string) ?? (p.exercise_id as string),
        value: Number(p.value),
        unit: p.unit as string,
        date: p.date as string,
        notes: (p.notes as string | null) ?? null,
        auto: p.notes === 'Registrado automaticamente',
      }));
      return { prs, exercises };
    },
  });
}

export function useAddPR(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { exerciseId: string; value: number; unit: string; notes: string | null }) => {
      const { error } = await supabase.from('pr_entries').insert({
        user_id: userId,
        exercise_id: input.exerciseId,
        value: input.value,
        unit: input.unit,
        date: toLocalISODate(),
        notes: input.notes,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.prs(userId) }),
  });
}

// ─── Conquistas ───────────────────────────────────────────────────────────────

export type AchievementItem = {
  id: string;
  type: 'session_count' | 'skill_exercise' | 'skill_level';
  name: string;
  description: string | null;
  threshold: number | null;
  skill_id: string | null;
  target_level: string | null;
  unlocked_at: string | null;
};

export function useAchievements(userId: string) {
  return useQuery({
    queryKey: qk.achievements(userId),
    queryFn: async () => {
      const [all, mine] = await Promise.all([
        supabase
          .from('achievements')
          .select('id, type, name, description, threshold, skill_id, target_level')
          .order('type')
          .order('threshold', { nullsFirst: false }),
        supabase.from('user_achievements').select('achievement_id, unlocked_at').eq('user_id', userId),
      ]);
      if (all.error) throw new Error(all.error.message);
      const unlocked = new Map((mine.data ?? []).map((u) => [u.achievement_id as string, u.unlocked_at as string]));
      return (all.data ?? []).map((a) => ({ ...a, unlocked_at: unlocked.get(a.id as string) ?? null })) as AchievementItem[];
    },
  });
}
