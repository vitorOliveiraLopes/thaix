import {
  applyOps,
  buildAdaptiveProfile,
  filterByEquipment,
  fitWorkoutToMinutes,
  selectExercisesFromPool,
  selectSkillsForToday,
  toLocalISODate,
  workoutSeed,
  type HistoryItem,
  type HistoryResult,
  type SkillExercise,
} from '@thaix/core';

import { supabase } from './supabase';

// I/O do gerador de treino no app. As decisões vêm do @thaix/core;
// aqui só buscamos dados no Supabase (sob RLS) e gravamos o resultado.

export type WorkoutItem = {
  skill_exercise_id: string;
  order_index: number;
  sets: number;
  reps: number | null;
  time_sec: number | null;
  exercise: SkillExercise;
};

export type Workout = {
  id: string;
  skill_id: string;
  date: string;
  week_number: number;
  completed_at: string | null;
  items: WorkoutItem[];
};

type RawItem = {
  skill_exercise_id: string;
  order_index: number;
  sets: number;
  reps: number | null;
  time_sec: number | null;
  skill_exercises: SkillExercise;
};

type RawWorkout = {
  id: string;
  skill_id: string;
  date: string;
  week_number: number;
  completed_at: string | null;
  daily_workout_items: RawItem[];
};

const WORKOUT_SELECT = 'id, skill_id, date, week_number, completed_at, daily_workout_items(skill_exercise_id, order_index, sets, reps, time_sec, skill_exercises(*))';

function mapWorkout(w: RawWorkout): Workout {
  return {
    id: w.id,
    skill_id: w.skill_id,
    date: w.date,
    week_number: w.week_number,
    completed_at: w.completed_at ?? null,
    items: [...(w.daily_workout_items ?? [])]
      .sort((a, b) => a.order_index - b.order_index)
      .map((item) => ({
        skill_exercise_id: item.skill_exercise_id,
        order_index: item.order_index,
        sets: item.sets,
        reps: item.reps,
        time_sec: item.time_sec,
        exercise: item.skill_exercises,
      })),
  };
}

export async function fetchTodayWorkouts(userId: string, date = toLocalISODate()): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('daily_workouts')
    .select(WORKOUT_SELECT)
    .eq('user_id', userId)
    .eq('date', date);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawWorkout[]).map(mapWorkout);
}

export async function fetchWorkout(workoutId: string): Promise<Workout> {
  const { data, error } = await supabase.from('daily_workouts').select(WORKOUT_SELECT).eq('id', workoutId).single();
  if (error || !data) throw new Error(error?.message ?? 'Treino não encontrado');
  return mapWorkout(data as unknown as RawWorkout);
}

async function fetchAdaptiveProfile(userId: string, skillId: string) {
  const { data: recent } = await supabase
    .from('daily_workouts')
    .select('id, date')
    .eq('user_id', userId)
    .eq('skill_id', skillId)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })
    .limit(3);

  const ids = (recent ?? []).map((w) => w.id as string);
  const previousId = ids[1];

  const [resultsRes, previousRes] = await Promise.all([
    ids.length > 0
      ? supabase
          .from('daily_workout_results')
          .select('daily_workout_id, skill_exercise_id, reps_achieved, time_achieved_sec, perceived_effort')
          .in('daily_workout_id', ids)
      : Promise.resolve({ data: [] as HistoryResult[] }),
    previousId
      ? supabase.from('daily_workout_items').select('skill_exercise_id, skill_exercises(category)').eq('daily_workout_id', previousId)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const previousItems: HistoryItem[] = ((previousRes.data ?? []) as { skill_exercise_id: string; skill_exercises: { category: string } | null }[]).map(
    (i) => ({ skill_exercise_id: i.skill_exercise_id, category: i.skill_exercises?.category ?? null }),
  );

  return buildAdaptiveProfile(ids, (resultsRes.data ?? []) as HistoryResult[], previousItems);
}

/**
 * Treinos de hoje: devolve os já gerados ou gera agora.
 *
 * Seguro contra chamadas repetidas: chamadas simultâneas do mesmo aluno
 * compartilham a mesma execução, o cabeçalho usa upsert com ignoreDuplicates
 * e os itens só entram em treino que ainda não tem nenhum. Um treino que
 * ficou sem itens (falha no meio do caminho) é completado na próxima vez.
 */
const inFlight = new Map<string, Promise<Workout[]>>();

export function generateTodayWorkouts(userId: string): Promise<Workout[]> {
  const today = toLocalISODate();
  const key = `${userId}|${today}`;
  const running = inFlight.get(key);
  if (running) return running;
  const job = doGenerate(userId, today).finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

async function doGenerate(userId: string, today: string): Promise<Workout[]> {
  const existing = await fetchTodayWorkouts(userId, today);
  if (existing.length > 0 && existing.every((w) => w.items.length > 0)) return existing;

  const { data: progress, error } = await supabase
    .from('user_skill_progress')
    .select('skill_id, level, week_number')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  if (!progress || progress.length === 0) return existing;

  // Rotina do aluno: tempo por sessão, equipamento e skill prioritária.
  const { data: routine } = await supabase
    .from('onboarding_responses')
    .select('session_minutes, equipment, focus_skill_id')
    .eq('user_id', userId)
    .maybeSingle();
  const sessionMinutes = (routine?.session_minutes as number | null) ?? null;
  const equipment = (routine?.equipment as string[] | null) ?? [];
  const focus = (routine?.focus_skill_id as string | null) ?? null;

  // Com treino já criado hoje, só completa as skills dele; senão escolhe as do dia.
  const skillsToday =
    existing.length > 0
      ? existing.map((w) => w.skill_id)
      : selectSkillsForToday(
          progress.map((p) => p.skill_id as string),
          new Date().getDay(),
          focus,
        );
  // O tempo da sessão é dividido entre as skills do dia.
  const minutesPerSkill = sessionMinutes ? Math.max(10, Math.round(sessionMinutes / Math.max(1, skillsToday.length))) : null;

  for (const skillId of skillsToday) {
    const p = progress.find((x) => x.skill_id === skillId);
    if (!p) continue;
    const current = existing.find((w) => w.skill_id === skillId);
    if (current && current.items.length > 0) continue;

    const [{ data: pool, error: poolError }, profile] = await Promise.all([
      supabase.from('skill_exercises').select('*').eq('skill_id', skillId).eq('level', p.level).order('order_index'),
      fetchAdaptiveProfile(userId, skillId),
    ]);
    if (poolError) throw new Error(poolError.message);

    const weekNumber = current?.week_number ?? p.week_number;
    // Só o que dá para fazer com o equipamento do aluno. Sem nada compatível,
    // cai no pool completo (melhor treinar com escala do que não treinar).
    const fullPool = (pool ?? []) as SkillExercise[];
    const usable = filterByEquipment(fullPool, equipment);
    const selected = selectExercisesFromPool({
      pool: usable.length > 0 ? usable : fullPool,
      level: p.level,
      weekNumber,
      seed: workoutSeed(userId, today, weekNumber),
      profile,
    });
    if (selected.length === 0) continue;

    // Encaixa no tempo disponível (corta mobilidade/core/força antes da skill).
    const asItems = selected.map((e, i) => ({
      order_index: i + 1,
      skill_exercise_id: e.id,
      sets: e.sets,
      reps: e.reps,
      time_sec: e.time_sec,
      exercise: e,
    }));
    const fitted = minutesPerSkill ? applyOps(asItems, fitWorkoutToMinutes(asItems, minutesPerSkill).ops) : asItems;
    const exercises = fitted.map((it) => ({ ...(it.exercise as SkillExercise), sets: it.sets, reps: it.reps, time_sec: it.time_sec }));

    let headerId = current?.id;
    if (!headerId) {
      const { error: upsertError } = await supabase
        .from('daily_workouts')
        .upsert(
          { user_id: userId, skill_id: skillId, date: today, week_number: weekNumber },
          { onConflict: 'user_id,skill_id,date', ignoreDuplicates: true },
        );
      if (upsertError) throw new Error(upsertError.message);

      const { data: header, error: headerError } = await supabase
        .from('daily_workouts')
        .select('id')
        .eq('user_id', userId)
        .eq('skill_id', skillId)
        .eq('date', today)
        .single();
      if (headerError || !header) throw new Error(headerError?.message ?? 'Treino não encontrado');
      headerId = header.id as string;
    }

    const { count, error: countError } = await supabase
      .from('daily_workout_items')
      .select('skill_exercise_id', { count: 'exact', head: true })
      .eq('daily_workout_id', headerId);
    if (countError) throw new Error(countError.message);

    if (!count) {
      const { error: itemsError } = await supabase.from('daily_workout_items').insert(
        exercises.map((e, i) => ({
          daily_workout_id: headerId,
          skill_exercise_id: e.id,
          order_index: i + 1,
          sets: e.sets,
          reps: e.reps,
          time_sec: e.time_sec,
        })),
      );
      if (itemsError) throw new Error(itemsError.message);
    }
  }

  return fetchTodayWorkouts(userId, today);
}

/** "Refazer": cria (ou reaproveita) o treino de hoje copiando os itens de um treino antigo. */
export async function cloneWorkout(userId: string, originalId: string): Promise<string> {
  const today = toLocalISODate();
  const original = await fetchWorkout(originalId);

  const { data: existingToday } = await supabase
    .from('daily_workouts')
    .select('id')
    .eq('user_id', userId)
    .eq('skill_id', original.skill_id)
    .eq('date', today)
    .maybeSingle();
  if (existingToday) return existingToday.id as string;

  const { data: cloned, error } = await supabase
    .from('daily_workouts')
    .insert({
      user_id: userId,
      skill_id: original.skill_id,
      date: today,
      week_number: original.week_number,
      // Marca a repetição no histórico ("Repetição" na tela da skill).
      source_workout_id: original.id,
    })
    .select('id')
    .single();
  if (error || !cloned) throw new Error(error?.message ?? 'Não foi possível criar o treino');

  const { error: itemsError } = await supabase.from('daily_workout_items').insert(
    original.items.map((item) => ({
      daily_workout_id: cloned.id,
      skill_exercise_id: item.skill_exercise_id,
      order_index: item.order_index,
      sets: item.sets,
      reps: item.reps,
      time_sec: item.time_sec,
    })),
  );
  if (itemsError) {
    await supabase.from('daily_workouts').delete().eq('id', cloned.id);
    throw new Error(itemsError.message);
  }
  return cloned.id as string;
}
