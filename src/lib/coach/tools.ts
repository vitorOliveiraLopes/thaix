import {
  BOX_KINDS,
  BOX_STIMULI,
  EQUIPMENT_OPTIONS,
  EXERCISE_EFFORT_LABELS,
  MIN_TRAINING_DAYS,
  SESSION_MINUTES_OPTIONS,
  applyOps,
  bestOfSets,
  boxRecommendation,
  estimateWorkoutMinutes,
  fitWorkoutToMinutes,
  initialSkillLevel,
  isSkillId,
  lightenWorkout,
  sessionMetAllGoalsMultiSet,
  setsRequiredToPass,
  skillName,
  swapCandidates,
  swapPlan,
  weekPlan,
  type CoachToolName,
  type PlanExercise,
  type WorkoutOp,
} from '@thaix/core'

import { daysAgo, loadSnapshot, loadTodayWorkouts, type CoachCtx, type TodayWorkout } from './context'

// ═══════════════════════════════════════════════════════════════════════════
// Leitura: executa na hora e devolve dados ao modelo
// ═══════════════════════════════════════════════════════════════════════════

type Json = Record<string, unknown>

export async function runReadTool(name: string, input: Json, ctx: CoachCtx): Promise<unknown> {
  switch (name) {
    case 'get_today_workout':
      return todayWorkout(ctx)
    case 'get_week_overview':
      return weekOverview(ctx)
    case 'get_progress_status':
      return progressStatus(ctx, String(input.skill_id ?? ''))
    case 'get_workout_history':
      return workoutHistory(ctx, input.skill_id as string | undefined, Number(input.limit ?? 5))
    case 'get_exercise_guide':
      return exerciseGuide(ctx, String(input.exercise ?? ''))
    case 'get_personal_records':
      return personalRecords(ctx, input.exercise as string | undefined)
    case 'get_box_log':
      return boxLog(ctx, Number(input.days ?? 7))
    default:
      return { error: `Ferramenta de leitura desconhecida: ${name}` }
  }
}

async function todayWorkout(ctx: CoachCtx) {
  const workouts = await loadTodayWorkouts(ctx)
  if (workouts.length === 0) return { workouts: [], note: 'Nenhum treino gerado hoje.' }
  return {
    workouts: workouts.map(w => ({
      skill: skillName(w.skill_id),
      skill_id: w.skill_id,
      completed: w.completed,
      estimated_minutes: estimateWorkoutMinutes(w.items),
      exercises: w.items.map(i => ({
        position: i.order_index,
        name: i.exercise.exercise_name,
        category: i.exercise.category,
        sets: i.sets,
        target: i.time_sec ? `${i.time_sec}s` : `${i.reps} reps`,
        rest_sec: i.exercise.rest_sec,
        coach_note: i.exercise.note,
      })),
    })),
  }
}

async function weekOverview(ctx: CoachCtx) {
  const snap = await loadSnapshot(ctx)
  const start = daysAgo(ctx.today, ctx.dow) // domingo desta semana
  const { data } = await ctx.client
    .from('daily_workouts')
    .select('date, skill_id, completed_at')
    .eq('user_id', ctx.userId)
    .gte('date', start)
    .lte('date', ctx.today)
  const done = (data ?? []).filter((w: any) => w.completed_at)
  const plan = weekPlan(snap.trainingDays, snap.skills.map(s => s.skill_id), snap.focusSkill)
  return {
    days: plan.map(d => {
      const date = daysAgo(ctx.today, ctx.dow - d.dow)
      const completed = done.filter((w: any) => w.date === date).map((w: any) => skillName(w.skill_id))
      const status = d.dow > ctx.dow ? 'futuro' : d.dow === ctx.dow ? 'hoje' : completed.length ? 'feito' : d.training ? 'perdido' : 'descanso'
      return { day: d.label, date, training_day: d.training, planned_skills: d.skills.map(skillName), completed, status }
    }),
    note: 'As skills previstas seguem a regra do gerador; o treino real é gerado no dia.',
  }
}

async function progressStatus(ctx: CoachCtx, skillId: string) {
  if (!isSkillId(skillId)) return { error: 'Skill inválida.' }
  const { data: progress } = await ctx.client
    .from('user_skill_progress')
    .select('level, week_number, sessions_at_current_level')
    .eq('user_id', ctx.userId)
    .eq('skill_id', skillId)
    .maybeSingle()
  if (!progress) return { error: `O aluno não treina ${skillName(skillId)} no app.` }

  const { data: last } = await ctx.client
    .from('daily_workouts')
    .select('id, date')
    .eq('user_id', ctx.userId)
    .eq('skill_id', skillId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(2)
  const ids = (last ?? []).map((w: any) => w.id)

  const sessions: unknown[] = []
  if (ids.length > 0) {
    const [res, items] = await Promise.all([
      ctx.client.from('daily_workout_results').select('daily_workout_id, skill_exercise_id, reps_achieved, time_achieved_sec, reps_per_set, time_per_set, perceived_effort').in('daily_workout_id', ids),
      ctx.client.from('daily_workout_items').select('daily_workout_id, skill_exercise_id, sets, reps, time_sec, skill_exercises(exercise_name)').in('daily_workout_id', ids),
    ])
    for (const w of last ?? []) {
      const goals = ((items.data ?? []) as any[]).filter(i => i.daily_workout_id === w.id)
      const results = ((res.data ?? []) as any[]).filter(r => r.daily_workout_id === w.id)
      const multi = results.map(r => ({
        skill_exercise_id: r.skill_exercise_id,
        reps_per_set: r.reps_per_set?.length ? r.reps_per_set : r.reps_achieved != null ? [r.reps_achieved] : [],
        time_per_set: r.time_per_set?.length ? r.time_per_set : r.time_achieved_sec != null ? [r.time_achieved_sec] : [],
        perceived_effort: r.perceived_effort ?? 3,
      }))
      sessions.push({
        date: (w as any).date,
        met_goal: sessionMetAllGoalsMultiSet(goals.map(g => ({ skill_exercise_id: g.skill_exercise_id, sets: g.sets ?? 1, reps: g.reps, time_sec: g.time_sec })), multi),
        exercises: goals.map(g => {
          const r = multi.find(m => m.skill_exercise_id === g.skill_exercise_id)
          const sets = g.time_sec ? r?.time_per_set : r?.reps_per_set
          const target = g.time_sec ?? g.reps
          const hit = (sets ?? []).filter((v: number | null) => v !== null && target != null && v >= target).length
          return {
            name: g.skill_exercises?.exercise_name,
            target: g.time_sec ? `${g.time_sec}s` : `${g.reps} reps`,
            best: sets?.length ? bestOfSets(sets) : null,
            sets_on_target: `${hit}/${g.sets} (precisa ${setsRequiredToPass(g.sets ?? 1)})`,
            effort: r ? EXERCISE_EFFORT_LABELS[r.perceived_effort] : null,
          }
        }),
      })
    }
  }

  return {
    skill: skillName(skillId),
    level: progress.level,
    week: progress.week_number,
    sessions_at_level: progress.sessions_at_current_level,
    rule: 'Sobe quando as 2 últimas sessões da skill batem a meta (2/3 das séries de cada exercício) e o esforço médio fica em até 2,5 de 5.',
    last_sessions: sessions,
    top_level: progress.level === 'avancado',
  }
}

async function workoutHistory(ctx: CoachCtx, skillId: string | undefined, limit: number) {
  let q = ctx.client
    .from('daily_workouts')
    .select('id, date, skill_id')
    .eq('user_id', ctx.userId)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })
    .limit(Math.min(10, Math.max(1, limit)))
  if (skillId && isSkillId(skillId)) q = q.eq('skill_id', skillId)
  const { data: workouts } = await q
  const ids = (workouts ?? []).map((w: any) => w.id)
  if (ids.length === 0) return { workouts: [] }
  const { data: results } = await ctx.client
    .from('daily_workout_results')
    .select('daily_workout_id, reps_achieved, time_achieved_sec, perceived_effort, skill_exercises(exercise_name)')
    .in('daily_workout_id', ids)
  return {
    workouts: (workouts ?? []).map((w: any) => ({
      date: w.date,
      skill: skillName(w.skill_id),
      results: ((results ?? []) as any[])
        .filter(r => r.daily_workout_id === w.id)
        .map(r => ({
          exercise: r.skill_exercises?.exercise_name,
          best: r.time_achieved_sec != null ? `${r.time_achieved_sec}s` : `${r.reps_achieved} reps`,
          effort: EXERCISE_EFFORT_LABELS[r.perceived_effort] ?? null,
        })),
    })),
  }
}

async function exerciseGuide(ctx: CoachCtx, query: string) {
  if (query.trim().length < 2) return { error: 'Informe o nome do exercício.' }
  const { data } = await ctx.client
    .from('skill_exercises')
    .select('id, exercise_name, category, level, skill_id, sets, reps, time_sec, rest_sec, note, equipment')
    .ilike('exercise_name', `%${query.trim()}%`)
    .limit(3)
  const ex = (data ?? [])[0] as any
  if (!ex) return { error: `Nenhum exercício do app parecido com "${query}".` }

  const [{ data: knowledge }, { data: related }] = await Promise.all([
    ctx.client.from('coach_knowledge').select('topic, content').eq('skill_exercise_id', ex.id),
    ctx.client.from('skill_exercises').select('exercise_name, level').eq('skill_id', ex.skill_id).eq('category', ex.category).neq('id', ex.id),
  ])
  const levels = ['iniciante', 'intermediario', 'avancado']
  const li = levels.indexOf(ex.level)
  return {
    name: ex.exercise_name,
    skill: skillName(ex.skill_id),
    category: ex.category,
    level: ex.level,
    base_dose: `${ex.sets}×${ex.time_sec ? `${ex.time_sec}s` : `${ex.reps} reps`}, descanso ${ex.rest_sec}s`,
    equipment: ex.equipment ?? [],
    coach_note: ex.note,
    knowledge: knowledge ?? [],
    easier: (related ?? []).filter((r: any) => levels.indexOf(r.level) < li).map((r: any) => r.exercise_name),
    harder: (related ?? []).filter((r: any) => levels.indexOf(r.level) > li).map((r: any) => r.exercise_name),
    other_matches: (data ?? []).slice(1).map((d: any) => d.exercise_name),
  }
}

async function personalRecords(ctx: CoachCtx, exercise?: string) {
  const [{ data: prs }, { data: names }] = await Promise.all([
    ctx.client.from('pr_entries').select('exercise_id, value, unit, date').eq('user_id', ctx.userId).order('date', { ascending: false }),
    ctx.client.from('skill_exercises').select('id, exercise_name'),
  ])
  const nameOf = new Map(((names ?? []) as any[]).map(n => [n.id, n.exercise_name]))
  const best = new Map<string, any>()
  for (const p of (prs ?? []) as any[]) {
    const key = `${p.exercise_id}|${p.unit}`
    if (!best.has(key) || Number(p.value) > Number(best.get(key).value)) best.set(key, p)
  }
  let list = [...best.values()].map(p => ({ exercise: nameOf.get(p.exercise_id) ?? p.exercise_id, value: Number(p.value), unit: p.unit, date: p.date }))
  if (exercise) list = list.filter(p => p.exercise.toLowerCase().includes(exercise.toLowerCase()))
  return { records: list.slice(0, 20) }
}

async function boxLog(ctx: CoachCtx, days: number) {
  const { data } = await ctx.client
    .from('box_sessions')
    .select('date, kind, intensity, stimulus, notes')
    .eq('user_id', ctx.userId)
    .gte('date', daysAgo(ctx.today, Math.min(14, Math.max(1, days))))
    .order('date', { ascending: false })
  const today = ((data ?? []) as any[]).filter(s => s.date === ctx.today)
  return { sessions: data ?? [], recommendation_today: boxRecommendation(today) }
}

// ═══════════════════════════════════════════════════════════════════════════
// Escrita: monta a proposta (com prévia) — nada é gravado aqui
// ═══════════════════════════════════════════════════════════════════════════

export type Proposal = { summary: string; preview: string[]; payload: Json }
export type ProposalResult = Proposal | { error: string }

function pickWorkout(workouts: TodayWorkout[], skillId?: unknown): TodayWorkout | { error: string } {
  const pending = workouts.filter(w => !w.completed)
  if (workouts.length === 0) return { error: 'Não há treino gerado hoje. O aluno precisa abrir a tela inicial (ou tocar em "Treinar mesmo assim" no dia de descanso).' }
  if (pending.length === 0) return { error: 'O treino de hoje já foi concluído; não dá para ajustar.' }
  if (typeof skillId === 'string' && skillId) {
    const w = pending.find(p => p.skill_id === skillId)
    if (!w) return { error: `Não há treino pendente de ${skillName(skillId)} hoje.` }
    return w
  }
  return pending[0]
}

function opsPayload(w: TodayWorkout, ops: WorkoutOp[]): Json {
  // Guarda o estado esperado para conferir na confirmação (o treino pode ter mudado).
  return { workout_id: w.id, ops, expected: w.items.map(i => ({ order_index: i.order_index, skill_exercise_id: i.skill_exercise_id, sets: i.sets })) }
}

function resolveItem(w: TodayWorkout[], ref: string) {
  const pending = w.filter(x => !x.completed)
  const n = Number(ref)
  for (const wk of pending) {
    if (Number.isInteger(n) && n > 0) {
      const byPos = wk.items.find(i => i.order_index === n)
      if (byPos) return { workout: wk, item: byPos }
    }
    const byName = wk.items.find(i => i.exercise.exercise_name.toLowerCase().includes(ref.toLowerCase().trim()))
    if (byName) return { workout: wk, item: byName }
  }
  return null
}

export async function buildProposal(name: CoachToolName, input: Json, ctx: CoachCtx): Promise<ProposalResult> {
  switch (name) {
    case 'fit_workout_to_time': {
      const minutes = Number(input.minutes)
      if (!Number.isFinite(minutes) || minutes < 5) return { error: 'Informe pelo menos 5 minutos.' }
      const w = pickWorkout(await loadTodayWorkouts(ctx), input.skill_id)
      if ('error' in w) return w
      const plan = fitWorkoutToMinutes(w.items, minutes)
      if (plan.ops.length === 0) return { error: plan.preview[0] }
      return { summary: `Encaixar o treino de ${skillName(w.skill_id)} em ${minutes} min`, preview: plan.preview, payload: opsPayload(w, plan.ops) }
    }

    case 'lighten_workout': {
      const w = pickWorkout(await loadTodayWorkouts(ctx), input.skill_id)
      if ('error' in w) return w
      const intensity = input.intensity === 'forte' ? 'forte' : 'leve'
      const plan = lightenWorkout(w.items, intensity, input.avoid_pulling === true)
      if (plan.ops.length === 0) return { error: 'O treino já está no mínimo; não há o que aliviar.' }
      return {
        summary: `Aliviar o treino de ${skillName(w.skill_id)}${input.reason ? ` (${String(input.reason).slice(0, 60)})` : ''}`,
        preview: plan.preview,
        payload: opsPayload(w, plan.ops),
      }
    }

    case 'swap_exercise': {
      const workouts = await loadTodayWorkouts(ctx)
      const found = resolveItem(workouts, String(input.exercise ?? ''))
      if (!found) return { error: `Não encontrei "${input.exercise}" no treino pendente de hoje.` }
      const snap = await loadSnapshot(ctx)
      const { data: pool } = await ctx.client
        .from('skill_exercises')
        .select('id, exercise_name, category, level, skill_id, rest_sec, equipment, sets, reps, time_sec')
        .eq('skill_id', found.item.exercise.skill_id)
        .eq('category', found.item.exercise.category)
      const reason = String(input.reason ?? '')
      const easierOnly = reason === 'mais_facil' || reason === 'desconforto'
      let candidates = swapCandidates(found.item.exercise, (pool ?? []) as any[], found.workout.items.map(i => i.skill_exercise_id), snap.equipment)
      if (easierOnly) {
        const lower = candidates.filter(c => c.level !== found.item.exercise.level)
        if (lower.length) candidates = lower
      }
      const pick = candidates[0] as (PlanExercise & { sets: number; reps: number | null; time_sec: number | null }) | undefined
      if (!pick) return { error: `Não há outro exercício de ${found.item.exercise.category} de ${skillName(found.item.exercise.skill_id)} disponível para trocar.` }
      const plan = swapPlan(found.item, pick)
      return {
        summary: `Trocar ${found.item.exercise.exercise_name} por ${pick.exercise_name}`,
        preview: plan.preview,
        payload: { ...opsPayload(found.workout, plan.ops), new_exercise: pick },
      }
    }

    case 'update_routine': {
      const patch: Json = {}
      const lines: string[] = []
      if (Array.isArray(input.training_days)) {
        const days = [...new Set((input.training_days as number[]).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
        if (days.length < MIN_TRAINING_DAYS) return { error: `São pelo menos ${MIN_TRAINING_DAYS} dias de treino.` }
        patch.dias_semana = days
        patch.frequencia = days.length
        lines.push(`Dias: ${days.map(d => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d]).join(', ')}`)
      }
      if (input.session_minutes !== undefined) {
        const m = Number(input.session_minutes)
        if (!(SESSION_MINUTES_OPTIONS as readonly number[]).includes(m)) return { error: 'Tempo por sessão deve ser 20, 30, 45 ou 60 min.' }
        patch.session_minutes = m
        lines.push(`Tempo por sessão: ${m} min`)
      }
      if (Array.isArray(input.equipment)) {
        const valid = new Set<string>(EQUIPMENT_OPTIONS.map(e => e.id))
        const eq = (input.equipment as string[]).filter(e => valid.has(e))
        if (eq.length === 0) return { error: 'Informe ao menos um equipamento (ou "chao").' }
        patch.equipment = eq
        lines.push(`Equipamento: ${eq.map(e => EQUIPMENT_OPTIONS.find(o => o.id === e)!.label).join(', ')}`)
      }
      if (lines.length === 0) return { error: 'Nada para mudar na rotina.' }
      lines.push('Vale a partir do próximo treino gerado.')
      return { summary: 'Atualizar sua rotina', preview: lines, payload: { patch } }
    }

    case 'set_focus_skill': {
      const id = String(input.skill_id ?? '')
      if (id === 'nenhuma') return { summary: 'Remover a skill prioritária', preview: ['As skills voltam a se revezar normalmente.'], payload: { skill_id: null } }
      if (!isSkillId(id)) return { error: 'Skill inválida.' }
      const snap = await loadSnapshot(ctx)
      if (!snap.skills.some(s => s.skill_id === id)) return { error: `${skillName(id)} não está nas trilhas do aluno. Use add_skill antes.` }
      const preview = [`${skillName(id)} entra em todos os seus dias de treino.`]
      if (id === 'hspu') preview.push('Como HSPU não combina com puxada, as skills de puxada saem dos dias de treino enquanto o foco for HSPU.')
      if (['pull-up', 'c2b', 'bmu'].includes(id)) preview.push('As outras skills de puxada e o HSPU saem dos dias de treino enquanto este for o foco.')
      return { summary: `Priorizar ${skillName(id)}`, preview, payload: { skill_id: id } }
    }

    case 'add_skill': {
      const id = String(input.skill_id ?? '')
      if (!isSkillId(id)) return { error: 'Skill inválida.' }
      const snap = await loadSnapshot(ctx)
      if (snap.skills.some(s => s.skill_id === id)) return { error: `${skillName(id)} já está nas trilhas do aluno.` }
      const { data: ob } = await ctx.client.from('onboarding_responses').select('pushups, pullups').eq('user_id', ctx.userId).maybeSingle()
      const level = initialSkillLevel(ob?.pushups ?? 0, ob?.pullups ?? 0)
      return { summary: `Adicionar ${skillName(id)} às suas trilhas`, preview: [`Começa no nível ${level}, semana 1.`], payload: { skill_id: id, level } }
    }

    case 'set_goal': {
      const description = String(input.description ?? '').trim().slice(0, 200)
      if (description.length < 3) return { error: 'Descreva o objetivo.' }
      const date = typeof input.target_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.target_date) ? input.target_date : null
      const skill = typeof input.skill_id === 'string' && isSkillId(input.skill_id) ? input.skill_id : null
      return {
        summary: 'Registrar objetivo',
        preview: [description, date ? `Data alvo: ${date.split('-').reverse().join('/')}` : 'Sem data definida'],
        payload: { description, target_date: date, skill_id: skill },
      }
    }

    case 'log_box_session': {
      const intensity = Math.round(Number(input.intensity))
      if (!(intensity >= 1 && intensity <= 5)) return { error: 'Intensidade de 1 a 5.' }
      if (!(BOX_KINDS as readonly string[]).includes(String(input.kind))) return { error: `Tipo de treino inválido. Use: ${BOX_KINDS.join(', ')}.` }
      const date = typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : ctx.today
      const stimulus = Array.isArray(input.stimulus) ? (input.stimulus as string[]).filter(x => (BOX_STIMULI as readonly string[]).includes(x)) : []
      return {
        summary: 'Registrar treino da box',
        preview: [
          `${String(input.kind).toUpperCase()} · intensidade ${intensity}/5`,
          stimulus.length ? `Estímulo: ${stimulus.join(', ')}` : 'Sem estímulo informado',
          ...(input.notes ? [String(input.notes).slice(0, 120)] : []),
        ],
        payload: { date, kind: input.kind, intensity, stimulus, notes: input.notes ? String(input.notes).slice(0, 300) : null },
      }
    }

    case 'register_limitation': {
      const area = String(input.body_area ?? '').trim().slice(0, 60)
      const description = String(input.description ?? '').trim().slice(0, 200)
      if (!area) return { error: 'Informe a região.' }
      return { summary: `Registrar limitação: ${area}`, preview: [description, 'Não é diagnóstico. Procure um profissional se persistir.'], payload: { body_area: area, description } }
    }

    case 'resolve_limitation': {
      const area = String(input.body_area ?? '').trim().replace(/[%_\\]/g, '')
      if (area.length < 2) return { error: 'Informe a região.' }
      const { data } = await ctx.client.from('student_limitations').select('id, body_area').eq('user_id', ctx.userId).eq('active', true).ilike('body_area', `%${area}%`)
      if (!data?.length) return { error: `Nenhuma limitação ativa em "${area}".` }
      return { summary: `Marcar ${data[0].body_area} como resolvido`, preview: ['Que bom que melhorou!'], payload: { ids: data.map((d: any) => d.id) } }
    }

    case 'register_hydration':
      return { summary: 'Marcar a meta de água de hoje como cumprida', preview: [], payload: {} }

    case 'register_daily_effort': {
      const score = Math.round(Number(input.score))
      if (!(score >= 0 && score <= 10)) return { error: 'Esforço de 0 a 10.' }
      return { summary: `Registrar esforço do dia: ${score}/10`, preview: [], payload: { score } }
    }

    case 'update_weight': {
      const kg = Number(input.weight_kg)
      if (!(kg >= 25 && kg <= 300)) return { error: 'Esse peso não parece correto.' }
      return { summary: `Atualizar peso para ${kg} kg`, preview: [], payload: { weight_kg: kg } }
    }

    case 'register_pr': {
      const value = Number(input.value)
      const unit = ['reps', 'seconds', 'kg'].includes(String(input.unit)) ? String(input.unit) : 'reps'
      const raw = String(input.exercise ?? '').trim()
      if (!raw || !(value > 0)) return { error: 'Informe exercício e valor.' }
      const { data } = await ctx.client.from('skill_exercises').select('id, exercise_name').ilike('exercise_name', `%${raw}%`).limit(1)
      const match = (data ?? [])[0] as any
      const label = match?.exercise_name ?? raw
      const u = unit === 'reps' ? 'reps' : unit === 'seconds' ? 's' : 'kg'
      return { summary: `Registrar recorde: ${label} · ${value} ${u}`, preview: match ? [] : ['Exercício fora do app, salvo com o nome informado.'], payload: { exercise_id: match?.id ?? raw, value, unit } }
    }

    default:
      return { error: 'Ação não disponível.' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Execução: só depois do "Confirmar" do aluno
// ═══════════════════════════════════════════════════════════════════════════

export type ExecResult = { success: boolean; message: string; refresh: string[] }

const ok = (message: string, refresh: string[]): ExecResult => ({ success: true, message, refresh })
const fail = (message: string): ExecResult => ({ success: false, message, refresh: [] })

async function applyWorkoutOps(ctx: CoachCtx, payload: any): Promise<ExecResult> {
  const workouts = await loadTodayWorkouts(ctx)
  const w = workouts.find(x => x.id === payload.workout_id)
  if (!w) return fail('Esse treino não é mais o de hoje. Peça o ajuste de novo.')
  if (w.completed) return fail('O treino já foi concluído; não dá mais para ajustar.')

  // Confere se o treino ainda é o mesmo da prévia.
  const expected = (payload.expected ?? []) as { order_index: number; skill_exercise_id: string; sets: number }[]
  const same =
    expected.length === w.items.length &&
    expected.every(e => w.items.some(i => i.order_index === e.order_index && i.skill_exercise_id === e.skill_exercise_id && i.sets === e.sets))
  if (!same) return fail('O treino mudou desde a proposta. Peça o ajuste de novo para eu recalcular.')

  // Aplicação atômica e validada no banco (RPC): só reduz séries, troca por
  // exercício da mesma skill/categoria e marca o treino como ajustado.
  const ops = payload.ops as WorkoutOp[]
  const { error } = await ctx.client.rpc('coach_apply_workout_ops', { p_workout_id: w.id, p_ops: ops })
  if (error) return fail(`Não consegui ajustar o treino: ${error.message}`)

  const after = applyOps(w.items, ops, payload.new_exercise ? { [payload.new_exercise.id]: payload.new_exercise } : {})
  return ok(
    `Treino ajustado: ${after.length} exercícios, cerca de ${estimateWorkoutMinutes(after)} min. Como é um treino ajustado, ele conta para a sequência mas não para subir de nível. Bora! 💪`,
    ['today', 'workout'],
  )
}

export async function executeProposal(name: string, payload: any, ctx: CoachCtx): Promise<ExecResult> {
  const c = ctx.client
  switch (name) {
    case 'fit_workout_to_time':
    case 'lighten_workout':
    case 'swap_exercise':
      return applyWorkoutOps(ctx, payload)

    case 'update_routine': {
      // Só as colunas da rotina, mesmo que o payload tenha sido alterado.
      const raw = (payload.patch ?? {}) as Record<string, unknown>
      const patch: Record<string, unknown> = {}
      for (const k of ['dias_semana', 'frequencia', 'session_minutes', 'equipment']) if (k in raw) patch[k] = raw[k]
      if (Object.keys(patch).length === 0) return fail('Nada para atualizar.')
      const { error } = await c.from('onboarding_responses').update(patch).eq('user_id', ctx.userId)
      return error ? fail(`Não consegui salvar a rotina: ${error.message}`) : ok('Rotina atualizada. O próximo treino já sai assim.', ['routine', 'today'])
    }

    case 'set_focus_skill': {
      if (payload.skill_id !== null && !isSkillId(String(payload.skill_id))) return fail('Skill inválida.')
      const { error } = await c.from('onboarding_responses').update({ focus_skill_id: payload.skill_id }).eq('user_id', ctx.userId)
      if (error) return fail(`Não consegui salvar o foco: ${error.message}`)
      return ok(payload.skill_id ? `Foco em ${skillName(payload.skill_id)} definido! 🎯` : 'Foco removido.', ['routine'])
    }

    case 'add_skill': {
      if (!isSkillId(String(payload.skill_id))) return fail('Skill inválida.')
      const { data: ob0 } = await c.from('onboarding_responses').select('pushups, pullups').eq('user_id', ctx.userId).maybeSingle()
      payload.level = initialSkillLevel(ob0?.pushups ?? 0, ob0?.pullups ?? 0)
      const { error } = await c.from('user_skill_progress').insert({
        user_id: ctx.userId,
        skill_id: payload.skill_id,
        level: payload.level,
        week_number: 1,
        sessions_at_current_level: 0,
        updated_at: new Date().toISOString(),
      })
      if (error) return fail(`Não consegui adicionar a skill: ${error.message}`)
      // Mantém a lista do onboarding em dia (é ela que aparece nas telas de rotina).
      const { data: ob } = await c.from('onboarding_responses').select('skills').eq('user_id', ctx.userId).maybeSingle()
      const skills = [...new Set([...((ob?.skills as string[]) ?? []), payload.skill_id])]
      await c.from('onboarding_responses').update({ skills }).eq('user_id', ctx.userId)
      return ok(`${skillName(payload.skill_id)} adicionada às suas trilhas! 🚀`, ['skills', 'routine'])
    }

    case 'set_goal': {
      const { error } = await c.from('student_goals').insert({
        user_id: ctx.userId,
        description: String(payload.description ?? '').slice(0, 200),
        target_date: payload.target_date ?? null,
        skill_id: payload.skill_id ?? null,
      })
      return error ? fail(`Não consegui salvar o objetivo: ${error.message}`) : ok('Objetivo registrado. Vou acompanhar com você! 🎯', [])
    }

    case 'log_box_session': {
      const { error } = await c.from('box_sessions').insert({
        user_id: ctx.userId,
        date: payload.date,
        kind: payload.kind,
        intensity: payload.intensity,
        stimulus: payload.stimulus,
        notes: payload.notes ?? null,
      })
      return error ? fail(`Não consegui registrar o treino da box: ${error.message}`) : ok('Treino da box registrado.', [])
    }

    case 'register_limitation': {
      const { error } = await c.from('student_limitations').insert({
        user_id: ctx.userId,
        body_area: String(payload.body_area ?? '').slice(0, 60),
        description: String(payload.description ?? '').slice(0, 200),
      })
      return error ? fail(`Não consegui registrar: ${error.message}`) : ok('Registrado. Se persistir, procure um fisioterapeuta.', [])
    }

    case 'resolve_limitation': {
      const { error } = await c
        .from('student_limitations')
        .update({ active: false, resolved_at: new Date().toISOString() })
        .eq('user_id', ctx.userId)
        .in('id', Array.isArray(payload.ids) ? payload.ids : [])
      return error ? fail(`Não consegui atualizar: ${error.message}`) : ok('Marcado como resolvido. 🙌', [])
    }

    case 'register_hydration': {
      const { error } = await c.from('hydration_days').upsert({ user_id: ctx.userId, date: ctx.today, met_goal: true }, { onConflict: 'user_id,date' })
      return error ? fail(`Não consegui registrar a água: ${error.message}`) : ok('Água de hoje registrada! 💧', ['home'])
    }

    case 'register_daily_effort': {
      const score = Math.round(Number(payload.score))
      if (!(score >= 0 && score <= 10)) return fail('Esforço de 0 a 10.')
      const { error } = await c.from('daily_pain_logs').upsert({ user_id: ctx.userId, date: ctx.today, pain_score: score }, { onConflict: 'user_id,date' })
      return error ? fail(`Não consegui registrar o esforço: ${error.message}`) : ok(`Esforço do dia registrado: ${payload.score}/10.`, ['home', 'progress'])
    }

    case 'update_weight': {
      const kg = Number(payload.weight_kg)
      if (!(kg >= 25 && kg <= 300)) return fail('Esse peso não parece correto.')
      const results = await Promise.all([
        c.from('profiles').update({ weight_kg: kg }).eq('user_id', ctx.userId),
        c.from('weight_logs').upsert({ user_id: ctx.userId, date: ctx.today, weight_kg: kg }, { onConflict: 'user_id,date' }),
      ])
      const error = results.find(r => r.error)?.error
      return error ? fail(`Não consegui atualizar o peso: ${error.message}`) : ok(`Peso atualizado para ${payload.weight_kg} kg.`, ['account'])
    }

    case 'register_pr': {
      const { error } = await c.from('pr_entries').insert({ user_id: ctx.userId, exercise_id: payload.exercise_id, value: payload.value, unit: payload.unit, date: ctx.today, notes: 'Registrado via coach' })
      return error ? fail(`Não consegui registrar o recorde: ${error.message}`) : ok('Recorde registrado! 🏆', ['prs'])
    }

    default:
      return fail('Ação não reconhecida.')
  }
}
