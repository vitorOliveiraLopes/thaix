import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateStreak,
  estimateWorkoutMinutes,
  skillName,
  type PlanItem,
} from '@thaix/core'

/**
 * Contexto de uma requisição do coach: cliente do aluno (RLS) e a data
 * local do aparelho dele. O servidor roda em UTC, então "hoje" vem do app.
 */
export type CoachCtx = {
  client: SupabaseClient
  userId: string
  today: string // AAAA-MM-DD no fuso do aluno
  dow: number // 0 = domingo
}

export type TodayWorkout = {
  id: string
  skill_id: string
  week_number: number
  completed: boolean
  items: (PlanItem & { exercise: PlanItem['exercise'] & { note: string | null } })[]
}

export type StudentSnapshot = {
  name: string | null
  motivation: string | null
  blocker: string | null
  trainingDays: number[]
  sessionMinutes: number | null
  equipment: string[]
  focusSkill: string | null
  skills: { skill_id: string; level: string; week_number: number; sessions_at_current_level: number }[]
  streak: number
  recentAvgEffort: number | null
  effortToday: number | null
  weightKg: number | null
  goals: { description: string; skill_id: string | null; target_date: string | null }[]
  limitations: { body_area: string; description: string; since: string }[]
  boxLast7: { date: string; kind: string; intensity: number; stimulus: string[]; notes: string | null }[]
  today: TodayWorkout[]
}

/** Data local do Brasil para quando o app não mandar a dele. */
export function saoPauloToday(): { today: string; dow: number } {
  const now = new Date()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now)
  const [y, m, d] = today.split('-').map(Number)
  return { today, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
}

export function daysAgo(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d - n))
  return t.toISOString().slice(0, 10)
}

const ITEM_SELECT =
  'id, skill_id, week_number, completed_at, daily_workout_items(order_index, skill_exercise_id, sets, reps, time_sec, skill_exercises(id, exercise_name, category, level, skill_id, rest_sec, note, equipment))'

export async function loadTodayWorkouts(ctx: CoachCtx): Promise<TodayWorkout[]> {
  const { data, error } = await ctx.client
    .from('daily_workouts')
    .select(ITEM_SELECT)
    .eq('user_id', ctx.userId)
    .eq('date', ctx.today)
  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map(w => ({
    id: w.id,
    skill_id: w.skill_id,
    week_number: w.week_number,
    completed: !!w.completed_at,
    items: [...(w.daily_workout_items ?? [])]
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((it: any) => ({
        order_index: it.order_index,
        skill_exercise_id: it.skill_exercise_id,
        sets: it.sets,
        reps: it.reps,
        time_sec: it.time_sec,
        exercise: { ...it.skill_exercises, equipment: it.skill_exercises?.equipment ?? [] },
      })),
  }))
}

export async function loadSnapshot(ctx: CoachCtx): Promise<StudentSnapshot> {
  const c = ctx.client
  const [profile, onboarding, progress, workouts, effortToday, goals, limitations, box, today] = await Promise.all([
    c.from('profiles').select('name, weight_kg').eq('user_id', ctx.userId).maybeSingle(),
    c.from('onboarding_responses').select('*').eq('user_id', ctx.userId).maybeSingle(),
    c.from('user_skill_progress').select('skill_id, level, week_number, sessions_at_current_level').eq('user_id', ctx.userId),
    c
      .from('daily_workouts')
      .select('id, date')
      .eq('user_id', ctx.userId)
      .not('completed_at', 'is', null)
      .order('date', { ascending: false })
      .limit(90),
    c.from('daily_pain_logs').select('pain_score').eq('user_id', ctx.userId).eq('date', ctx.today).maybeSingle(),
    c.from('student_goals').select('description, skill_id, target_date').eq('user_id', ctx.userId).eq('status', 'active'),
    c.from('student_limitations').select('body_area, description, created_at').eq('user_id', ctx.userId).eq('active', true),
    c
      .from('box_sessions')
      .select('date, kind, intensity, stimulus, notes')
      .eq('user_id', ctx.userId)
      .gte('date', daysAgo(ctx.today, 7))
      .order('date', { ascending: false }),
    loadTodayWorkouts(ctx),
  ])

  const recentIds = (workouts.data ?? []).slice(0, 3).map((w: any) => w.id)
  let recentAvgEffort: number | null = null
  if (recentIds.length > 0) {
    const { data } = await c.from('daily_workout_results').select('perceived_effort').in('daily_workout_id', recentIds)
    const efforts = (data ?? []).map((r: any) => r.perceived_effort).filter((v: any) => typeof v === 'number')
    if (efforts.length > 0) recentAvgEffort = efforts.reduce((a: number, b: number) => a + b, 0) / efforts.length
  }

  const ob = (onboarding.data ?? {}) as Record<string, any>
  return {
    name: profile.data?.name ?? null,
    motivation: ob.motivacao ?? null,
    blocker: ob.trava ?? null,
    trainingDays: ob.dias_semana ?? [],
    sessionMinutes: ob.session_minutes ?? null,
    equipment: ob.equipment ?? [],
    focusSkill: ob.focus_skill_id ?? null,
    skills: (progress.data ?? []) as StudentSnapshot['skills'],
    streak: calculateStreak((workouts.data ?? []).map((w: any) => w.date), ctx.today),
    recentAvgEffort,
    effortToday: effortToday.data?.pain_score ?? null,
    weightKg: profile.data?.weight_kg ?? null,
    // Tabelas novas podem não existir antes do SQL da fase 2: falha vira lista vazia.
    goals: (goals.data ?? []) as StudentSnapshot['goals'],
    limitations: ((limitations.data ?? []) as any[]).map(l => ({ body_area: l.body_area, description: l.description, since: String(l.created_at).slice(0, 10) })),
    boxLast7: (box.data ?? []) as StudentSnapshot['boxLast7'],
    today,
  }
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MOTIVATION: Record<string, string> = {
  'primeira-pullup': 'primeira pull-up strict',
  kipping: 'destravar kipping/butterfly',
  'muscle-up': 'primeiro muscle-up',
  hspu: 'conseguir o HSPU',
  gluteo: 'glúteo forte para CrossFit',
  wods: 'render mais nos WODs',
  explorando: 'só explorando',
}
const BLOCKER: Record<string, string> = {
  tecnica: 'técnica que ninguém explicou',
  creators: 'intimidada pelos creators avançados',
  tempo: 'falta de tempo',
  wod: 'box só foca no WOD do dia',
}

/** Bloco de contexto do aluno (parte dinâmica do prompt). */
export function describeSnapshot(s: StudentSnapshot, ctx: CoachCtx): string {
  const skills = s.skills.length
    ? s.skills.map(k => `- ${skillName(k.skill_id)} (${k.skill_id}): ${k.level}, semana ${k.week_number}, ${k.sessions_at_current_level} sessões neste nível`).join('\n')
    : '- nenhuma skill iniciada'

  const today = s.today.length
    ? s.today
        .map(w => {
          const mins = estimateWorkoutMinutes(w.items)
          const list = w.items.map(i => `${i.order_index}. ${i.exercise.exercise_name} [${i.exercise.category}] ${i.sets}×${i.time_sec ? `${i.time_sec}s` : `${i.reps} reps`}`).join('; ')
          return `- ${skillName(w.skill_id)} (${w.completed ? 'CONCLUÍDO' : 'pendente'}, ~${mins} min): ${list}`
        })
        .join('\n')
    : s.trainingDays.length && !s.trainingDays.includes(ctx.dow)
      ? '- hoje é dia de descanso (se o aluno quiser treinar: create_workout, ou o botão "Treinar mesmo assim" na tela inicial)'
      : '- treino de hoje ainda não foi gerado (aparece ao abrir a tela inicial)'

  const box = s.boxLast7.length
    ? s.boxLast7.map(b => `- ${b.date}: ${b.kind}, intensidade ${b.intensity}/5, estímulo ${b.stimulus.join(', ') || '—'}${b.notes ? ` (${b.notes})` : ''}`).join('\n')
    : '- nada registrado'

  return `## Aluno
Nome: ${s.name ?? 'não informado'}
Hoje: ${WEEKDAYS[ctx.dow]}, ${ctx.today}
Motivação: ${s.motivation ? MOTIVATION[s.motivation] ?? s.motivation : '—'} · Trava: ${s.blocker ? BLOCKER[s.blocker] ?? s.blocker : '—'}
Dias de treino: ${s.trainingDays.length ? s.trainingDays.map(d => WEEKDAYS[d]).join(', ') : 'todos'}
Tempo por sessão: ${s.sessionMinutes ? `${s.sessionMinutes} min` : 'não informado'} · Equipamento: ${s.equipment.join(', ') || 'não informado'}
Skill prioritária: ${s.focusSkill ? skillName(s.focusSkill) : 'nenhuma'}
Sequência: ${s.streak} dia(s) · Esforço médio recente nos exercícios: ${s.recentAvgEffort !== null ? `${s.recentAvgEffort.toFixed(1)}/5` : 'sem dados'} · Esforço do dia: ${s.effortToday ?? 'não registrado'}/10
Peso: ${s.weightKg ? `${s.weightKg} kg` : 'não informado'}

## Skills
${skills}

## Treino de hoje
${today}

## Box (últimos 7 dias)
${box}

## Objetivos ativos
${s.goals.length ? s.goals.map(g => `- ${g.description}${g.target_date ? ` (até ${g.target_date})` : ''}`).join('\n') : '- nenhum'}

## Limitações relatadas (não são diagnóstico)
${s.limitations.length ? s.limitations.map(l => `- ${l.body_area}: ${l.description} (desde ${l.since})`).join('\n') : '- nenhuma'}`
}
