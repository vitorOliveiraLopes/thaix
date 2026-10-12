import {
  BOX_KINDS,
  BOX_STIMULI,
  EQUIPMENT_OPTIONS,
  EXERCISE_EFFORT_LABELS,
  MIN_TRAINING_DAYS,
  SESSION_MINUTES_OPTIONS,
  LEVEL_LABELS,
  applyOps,
  catalogTarget,
  formatSetsTarget,
  MAX_WORKOUT_EXERCISES,
  levelIndex,
  matchExercise,
  normalizeText,
  normalizeLevel,
  planCustomWorkout,
  previousLevel,
  recommendExercises,
  validateTarget,
  bestOfSets,
  boxRecommendation,
  estimateWorkoutMinutes,
  fitWorkoutToMinutes,
  initialSkillLevel,
  isRestDay,
  isSkillId,
  lightenWorkout,
  sessionMetAllGoalsMultiSet,
  setsRequiredToPass,
  skillName,
  swapCandidates,
  swapPlan,
  weekPlan,
  type ChatAttachment,
  type CoachToolName,
  type PlanExercise,
  type PlanItem,
  type WorkoutOp,
} from '@thaix/core'

import { daysAgo, loadSnapshot, loadTodayWorkouts, saoPauloToday, type CoachCtx, type TodayWorkout } from './context'
import { loadCatalog, planGeneratedWorkout } from './generate'

// ═══════════════════════════════════════════════════════════════════════════
// Exibição: card nativo no chat, montado com os dados do banco (não do modelo)
// ═══════════════════════════════════════════════════════════════════════════

export async function buildDisplay(name: string, input: Record<string, unknown>, ctx: CoachCtx): Promise<ChatAttachment[] | { error: string }> {
  if (name !== 'show_today_workout') return { error: 'Card desconhecido.' }
  const all = await loadTodayWorkouts(ctx)
  const workouts = typeof input.skill_id === 'string' ? all.filter(w => w.skill_id === input.skill_id) : all
  if (workouts.length === 0) {
    return { error: all.length ? 'Não há treino dessa skill hoje.' : 'Não há treino gerado hoje (ele aparece ao abrir a tela inicial).' }
  }
  return workouts.map(w => ({
    type: 'workout' as const,
    workout_id: w.id,
    skill_id: w.skill_id,
    week_number: w.week_number,
    completed: w.completed,
    minutes: estimateWorkoutMinutes(w.items),
    items: w.items.map(i => ({
      name: i.exercise.exercise_name,
      category: i.exercise.category,
      sets: i.sets,
      reps: i.reps,
      time_sec: i.time_sec,
    })),
  }))
}

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
    case 'recommend_exercises':
      return recommend(ctx, input)
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

const levelLabel = (level: string) => LEVEL_LABELS[normalizeLevel(level)]

async function skillProgress(ctx: CoachCtx, skillId: string) {
  const { data } = await ctx.client
    .from('user_skill_progress')
    .select('skill_id, level, week_number, sessions_at_current_level')
    .eq('user_id', ctx.userId)
    .eq('skill_id', skillId)
    .maybeSingle()
  return data as { skill_id: string; level: string; week_number: number; sessions_at_current_level: number } | null
}

async function recommend(ctx: CoachCtx, input: Json) {
  const skillId = String(input.skill_id ?? '')
  const progress = await skillProgress(ctx, skillId)
  if (!progress) return { error: `${skillName(skillId)} não está nas trilhas do aluno.` }
  const [catalog, { data: routine }, today] = await Promise.all([
    loadCatalog(ctx, skillId),
    ctx.client.from('onboarding_responses').select('equipment').eq('user_id', ctx.userId).maybeSingle(),
    loadTodayWorkouts(ctx),
  ])
  // Fora do treino de hoje pelo id e pelo nome (o mesmo exercício existe em mais de um nível).
  const todayNames = new Set(today.filter(w => w.skill_id === skillId).flatMap(w => w.items.map(i => normalizeText(i.exercise.exercise_name))))
  const inToday = catalog.filter(e => todayNames.has(normalizeText(e.exercise_name))).map(e => e.id)
  const list = recommendExercises(catalog, {
    level: progress.level,
    equipment: (routine?.equipment as string[] | null) ?? [],
    exclude: inToday,
    category: typeof input.category === 'string' ? input.category : null,
    includeNextLevel: input.include_next_level === true,
  })
  return {
    skill: skillName(skillId),
    student_level: levelLabel(progress.level),
    exercises: list.map(e => ({
      name: e.exercise_name,
      category: e.category,
      level: levelLabel(e.level),
      fit: e.fit,
      target: formatSetsTarget(catalogTarget(e, progress.level, progress.week_number)),
      note: e.note,
    })),
    note: list.length ? undefined : 'Nada novo para recomendar com esse filtro e o equipamento do aluno.',
  }
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

    case 'add_exercise': {
      const w = pickWorkout(await loadTodayWorkouts(ctx), input.skill_id)
      if ('error' in w) return w
      const progress = await skillProgress(ctx, w.skill_id)
      if (!progress) return { error: `${skillName(w.skill_id)} não está nas trilhas do aluno.` }
      const cur = levelIndex(progress.level)
      const catalog = (await loadCatalog(ctx, w.skill_id)).sort(
        (a, b) => Math.abs(levelIndex(a.level) - cur) - Math.abs(levelIndex(b.level) - cur),
      )
      const inWorkout = new Set(w.items.map(i => normalizeText(i.exercise.exercise_name)))
      const allowed = catalog.filter(e => levelIndex(e.level) <= cur && !inWorkout.has(normalizeText(e.exercise_name)))
      const { match, candidates } = matchExercise(allowed, String(input.exercise ?? ''))
      if (!match) {
        if (candidates.length) return { error: `Mais de um exercício com esse nome: ${candidates.map(c => c.exercise_name).join(', ')}. Pergunte qual.` }
        if (matchExercise(catalog, String(input.exercise ?? '')).match)
          return { error: 'Esse exercício já está no treino ou é de um nível acima do aluno.' }
        return { error: `Não achei "${input.exercise}" no catálogo de ${skillName(w.skill_id)}. Use recommend_exercises para ver as opções.` }
      }
      const target = catalogTarget(match, progress.level, w.week_number)
      const op: WorkoutOp = { type: 'add', skill_exercise_id: match.id, ...target }
      const after = applyOps(w.items, [op], { [match.id]: match })
      return {
        summary: `Adicionar ${match.exercise_name} ao treino de ${skillName(w.skill_id)}`,
        preview: [
          `${match.exercise_name} (${formatSetsTarget(target)}) no fim do treino`,
          `Duração estimada: ${estimateWorkoutMinutes(w.items)} → ${estimateWorkoutMinutes(after)} min`,
        ],
        payload: { ...opsPayload(w, [op]), exercises: { [match.id]: match } },
      }
    }

    case 'remove_exercise': {
      const found = resolveItem(await loadTodayWorkouts(ctx), String(input.exercise ?? ''))
      if (!found) return { error: `Não encontrei "${input.exercise}" no treino pendente de hoje.` }
      if (found.workout.items.length <= 1) return { error: 'É o único exercício do treino; não dá para tirar.' }
      const op: WorkoutOp = { type: 'remove', order_index: found.item.order_index }
      const after = applyOps(found.workout.items, [op])
      return {
        summary: `Tirar ${found.item.exercise.exercise_name} do treino`,
        preview: [`Duração estimada: ${estimateWorkoutMinutes(found.workout.items)} → ${estimateWorkoutMinutes(after)} min`],
        payload: opsPayload(found.workout, [op]),
      }
    }

    case 'adjust_exercise': {
      const found = resolveItem(await loadTodayWorkouts(ctx), String(input.exercise ?? ''))
      if (!found) return { error: `Não encontrei "${input.exercise}" no treino pendente de hoje.` }
      const target = validateTarget(found.item, input)
      if ('error' in target) return target
      const op: WorkoutOp = { type: 'set_target', order_index: found.item.order_index, ...target }
      return {
        summary: `Mudar a meta de ${found.item.exercise.exercise_name}`,
        preview: [`${formatSetsTarget(found.item)} → ${formatSetsTarget(target)}`],
        payload: opsPayload(found.workout, [op]),
      }
    }

    case 'create_workout': {
      const skillId = String(input.skill_id ?? '')
      if (!isSkillId(skillId)) return { error: 'Skill inválida.' }
      const progress = await skillProgress(ctx, skillId)
      if (!progress) return { error: `${skillName(skillId)} não está nas trilhas do aluno. Use add_skill antes.` }
      const snap = await loadSnapshot(ctx)
      // Dia de treino sem treino gerado: a tela inicial monta as skills do dia.
      // Criar um antes mudaria o plano do dia sem o aluno perceber.
      if (snap.today.length === 0 && !isRestDay(snap.trainingDays, ctx.dow))
        return { error: 'Hoje é dia de treino e o treino ainda não foi gerado: peça para o aluno abrir a tela inicial primeiro.' }
      const existing = snap.today.find(w => w.skill_id === skillId)
      if (existing)
        return {
          error: existing.completed
            ? `O treino de ${skillName(skillId)} de hoje já foi concluído.`
            : `Já existe um treino de ${skillName(skillId)} hoje. Para mudá-lo, use add_exercise, remove_exercise, swap_exercise ou adjust_exercise.`,
        }
      const minutes = Number.isInteger(input.minutes) ? Math.min(90, Math.max(10, Number(input.minutes))) : null
      const names = Array.isArray(input.exercises) ? (input.exercises as unknown[]).map(String).filter(n => n.trim()) : []

      let items: PlanItem[]
      const custom = names.length > 0
      if (custom) {
        const plan = planCustomWorkout(await loadCatalog(ctx, skillId), names, { skillId, level: progress.level, weekNumber: progress.week_number })
        const problems = [
          ...plan.missing.map(n => `"${n}" não está no catálogo`),
          ...plan.tooHard.map(n => `"${n}" é de um nível acima do aluno`),
          ...plan.ambiguous.map(a => `"${a.query}" pode ser: ${a.options.join(', ')}`),
        ]
        if (problems.length) return { error: `${problems.join('; ')}. Use recommend_exercises para ver as opções.` }
        items = plan.items.map((e, i) => ({ order_index: i + 1, skill_exercise_id: e.id, ...e.target, exercise: e }))
        if (minutes) items = applyOps(items, fitWorkoutToMinutes(items, minutes).ops)
      } else {
        const plan = await planGeneratedWorkout(ctx, skillId, minutes)
        if ('error' in plan) return plan
        items = plan.items
      }

      return {
        summary: `Criar treino de ${skillName(skillId)} para hoje`,
        preview: [
          ...items.map(i => `${i.exercise.exercise_name}: ${formatSetsTarget(i)}`),
          `Cerca de ${estimateWorkoutMinutes(items)} min · ${levelLabel(progress.level)}, semana ${progress.week_number}`,
          custom ? 'Treino personalizado: conta para a sequência, não para subir de nível.' : 'Montado pelo método: conta para subir de nível.',
        ],
        // Treino do método é refeito na confirmação; o personalizado guarda os itens.
        payload: {
          skill_id: skillId,
          date: ctx.today,
          custom,
          minutes,
          items: custom ? items.map(i => ({ skill_exercise_id: i.skill_exercise_id, sets: i.sets, reps: i.reps, time_sec: i.time_sec })) : [],
        },
      }
    }

    case 'remove_skill': {
      const id = String(input.skill_id ?? '')
      const snap = await loadSnapshot(ctx)
      const progress = snap.skills.find(s => s.skill_id === id)
      if (!progress) return { error: `${skillName(id)} não está nas trilhas do aluno.` }
      if (snap.skills.length <= 1) return { error: 'É a única skill do aluno; é preciso manter pelo menos uma.' }
      const pending = snap.today.some(w => w.skill_id === id && !w.completed)
      return {
        summary: `Tirar ${skillName(id)} das suas trilhas`,
        preview: [
          `Seu nível (${levelLabel(progress.level)}, semana ${progress.week_number}) fica guardado: se voltar, continua de onde parou.`,
          ...(snap.focusSkill === id ? ['Ela deixa de ser a skill prioritária.'] : []),
          ...(pending ? [`O treino de ${skillName(id)} de hoje sai da tela inicial.`] : []),
          'O histórico de treinos continua salvo.',
        ],
        payload: { skill_id: id },
      }
    }

    case 'change_skill_level': {
      const id = String(input.skill_id ?? '')
      if (input.direction !== 'down') return { error: 'Subir de nível só acontece pelo desempenho nos treinos.' }
      const progress = await skillProgress(ctx, id)
      if (!progress) return { error: `${skillName(id)} não está nas trilhas do aluno.` }
      const prev = previousLevel(progress.level)
      if (!prev) return { error: `${skillName(id)} já está no primeiro nível.` }
      return {
        summary: `Voltar ${skillName(id)} para o ${levelLabel(prev)}`,
        preview: [
          `Nível: ${levelLabel(progress.level)} → ${levelLabel(prev)}`,
          'Para subir de novo, valem as mesmas regras de desempenho.',
          'Se o treino dessa skill de hoje ainda não foi feito, ele é refeito no novo nível.',
        ],
        payload: { skill_id: id, from: progress.level },
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
      const [{ data: ob }, { data: paused }] = await Promise.all([
        ctx.client.from('onboarding_responses').select('pushups, pullups').eq('user_id', ctx.userId).maybeSingle(),
        // Sem a tabela (SQL da fase 3 não rodado), segue como skill nova.
        ctx.client.from('user_skill_paused').select('level, week_number').eq('user_id', ctx.userId).eq('skill_id', id).maybeSingle(),
      ])
      if (paused)
        return {
          summary: `Trazer ${skillName(id)} de volta às suas trilhas`,
          preview: [`Continua de onde parou: ${levelLabel(paused.level)}, semana ${paused.week_number}.`],
          payload: { skill_id: id },
        }
      const level = initialSkillLevel(ob?.pushups ?? 0, ob?.pullups ?? 0)
      return { summary: `Adicionar ${skillName(id)} às suas trilhas`, preview: [`Começa no ${levelLabel(level)}, semana 1.`], payload: { skill_id: id } }
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

  const exercises = { ...(payload.exercises ?? {}), ...(payload.new_exercise ? { [payload.new_exercise.id]: payload.new_exercise } : {}) }
  const after = applyOps(w.items, ops, exercises)
  return ok(
    `Treino ajustado: ${after.length} exercícios, cerca de ${estimateWorkoutMinutes(after)} min. Como é um treino ajustado, ele conta para a sequência mas não para subir de nível. Bora! 💪`,
    ['today', 'workout'],
  )
}

type NewItem = { skill_exercise_id: string; sets: number; reps: number | null; time_sec: number | null }

/** Cabeçalho + itens do treino de hoje; desfaz o cabeçalho se os itens falharem. */
async function insertWorkout(ctx: CoachCtx, skillId: string, weekNumber: number, items: NewItem[], adjusted: boolean): Promise<string | null> {
  const c = ctx.client
  const { data: header, error } = await c
    .from('daily_workouts')
    .insert({ user_id: ctx.userId, skill_id: skillId, date: ctx.today, week_number: weekNumber, ...(adjusted ? { adjusted: true } : {}) })
    .select('id')
    .single()
  if (error || !header) {
    return error?.code === '23505' ? `Já existe um treino de ${skillName(skillId)} hoje.` : `Não consegui criar o treino: ${error?.message ?? 'erro'}`
  }
  const { error: itemsError } = await c.from('daily_workout_items').insert(
    items.map((i, idx) => ({ daily_workout_id: header.id, skill_exercise_id: i.skill_exercise_id, order_index: idx + 1, sets: i.sets, reps: i.reps, time_sec: i.time_sec })),
  )
  if (itemsError) {
    await c.from('daily_workouts').delete().eq('id', header.id)
    return `Não consegui criar o treino: ${itemsError.message}`
  }
  return null
}

/**
 * Grava o treino da proposta. O payload fica no banco até a confirmação e o
 * aluno consegue editá-lo, então nada dele decide o que conta para subir de
 * nível: o treino do método é refeito aqui, e o personalizado é sempre
 * gravado como ajustado, com cada item conferido contra o catálogo.
 */
async function createWorkout(ctx: CoachCtx, payload: { skill_id?: unknown; date?: unknown; custom?: unknown; minutes?: unknown; items?: unknown }): Promise<ExecResult> {
  const c = ctx.client
  const skillId = String(payload.skill_id ?? '')
  if (!isSkillId(skillId)) return fail('Skill inválida.')
  // A data vem do aparelho: aceita só até 1 dia de diferença do servidor.
  if (payload.date !== ctx.today || Math.abs(Date.parse(ctx.today) - Date.parse(saoPauloToday().today)) > 86_400_000)
    return fail('Essa proposta era para outro dia. Peça de novo.')
  const progress = await skillProgress(ctx, skillId)
  if (!progress) return fail(`${skillName(skillId)} não está mais nas suas trilhas.`)

  if (payload.custom !== true) {
    const minutes = Number.isInteger(payload.minutes) ? Math.min(90, Math.max(10, Number(payload.minutes))) : null
    const plan = await planGeneratedWorkout(ctx, skillId, minutes)
    if ('error' in plan) return fail(plan.error)
    const err = await insertWorkout(ctx, skillId, progress.week_number, plan.items, false)
    return err ? fail(err) : ok(`Treino de ${skillName(skillId)} criado! Ele já está na tela inicial. Bora! 🔥`, ['today', 'workout', 'home'])
  }

  const items = (Array.isArray(payload.items) ? payload.items : []) as NewItem[]
  const ids = items.map(i => String(i?.skill_exercise_id))
  if (items.length === 0 || items.length > MAX_WORKOUT_EXERCISES || new Set(ids).size !== ids.length) return fail('Treino inválido. Peça de novo.')
  const { data: exs } = await c.from('skill_exercises').select('id, skill_id, level, reps, time_sec').in('id', ids)
  const byId = new Map(((exs ?? []) as { id: string; skill_id: string; level: string; reps: number | null; time_sec: number | null }[]).map(e => [e.id, e]))
  const int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi
  const valid = items.every(i => {
    const e = byId.get(i.skill_exercise_id)
    return (
      !!e &&
      e.skill_id === skillId &&
      levelIndex(e.level) <= levelIndex(progress.level) &&
      int(i.sets, 1, 6) &&
      // Mesmo tipo do catálogo: por repetição ou por tempo.
      (e.reps === null ? i.reps === null : int(i.reps, 1, 30)) &&
      (e.time_sec === null ? i.time_sec === null : int(i.time_sec, 5, 300))
    )
  })
  if (!valid) return fail('O treino tem exercícios que não valem para você. Peça de novo.')

  const err = await insertWorkout(ctx, skillId, progress.week_number, items, true)
  return err ? fail(err) : ok(`Treino de ${skillName(skillId)} criado! Ele já está na tela inicial. Bora! 🔥`, ['today', 'workout', 'home'])
}

export async function executeProposal(name: string, payload: any, ctx: CoachCtx): Promise<ExecResult> {
  const c = ctx.client
  switch (name) {
    case 'fit_workout_to_time':
    case 'lighten_workout':
    case 'swap_exercise':
    case 'add_exercise':
    case 'remove_exercise':
    case 'adjust_exercise':
      return applyWorkoutOps(ctx, payload)

    case 'create_workout':
      return createWorkout(ctx, payload)

    case 'remove_skill': {
      if (!isSkillId(String(payload.skill_id))) return fail('Skill inválida.')
      const { error } = await c.rpc('coach_manage_skill', { p_skill_id: payload.skill_id, p_action: 'remove' })
      if (error) return fail(`Não consegui tirar a skill: ${error.message}`)
      // Lista exibida nas telas de rotina (o gerador usa user_skill_progress).
      const { data: ob } = await c.from('onboarding_responses').select('skills').eq('user_id', ctx.userId).maybeSingle()
      if (Array.isArray(ob?.skills)) {
        await c.from('onboarding_responses').update({ skills: (ob.skills as string[]).filter(s => s !== payload.skill_id) }).eq('user_id', ctx.userId)
      }
      return ok(`${skillName(payload.skill_id)} saiu das suas trilhas. O nível ficou guardado se quiser voltar.`, ['skills', 'routine', 'today', 'progress', 'home'])
    }

    case 'change_skill_level': {
      if (!isSkillId(String(payload.skill_id))) return fail('Skill inválida.')
      const progress = await skillProgress(ctx, payload.skill_id)
      if (!progress || progress.level !== payload.from) return fail('O nível mudou desde a proposta. Peça de novo.')
      const hadPending = (await loadTodayWorkouts(ctx)).some(w => w.skill_id === payload.skill_id && !w.completed)
      const { data, error } = await c.rpc('coach_manage_skill', { p_skill_id: payload.skill_id, p_action: 'level_down' })
      if (error) return fail(`Não consegui mudar o nível: ${error.message}`)
      let note = ''
      // O banco tirou o treino pendente de hoje; refaz no nível novo.
      if (hadPending) {
        const plan = await planGeneratedWorkout(ctx, payload.skill_id, null)
        const err = 'error' in plan ? plan.error : await insertWorkout(ctx, payload.skill_id, plan.weekNumber, plan.items, false)
        note = err ? ' Abra a tela inicial para gerar o treino de hoje.' : ' O treino de hoje já está no nível novo.'
      }
      return ok(`${skillName(payload.skill_id)} agora está no ${levelLabel(String(data))}.${note} Técnica primeiro, o resto vem! 💪`, ['skills', 'today', 'workout', 'progress', 'home'])
    }

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
      const { data: paused } = await c.from('user_skill_paused').select('skill_id').eq('user_id', ctx.userId).eq('skill_id', payload.skill_id).maybeSingle()
      if (paused) {
        // Nível guardado ao tirar a skill: só o banco restaura (o aluno não grava essa tabela).
        const { error } = await c.rpc('coach_manage_skill', { p_skill_id: payload.skill_id, p_action: 'restore' })
        if (error) return fail(`Não consegui trazer a skill de volta: ${error.message}`)
      } else {
        const { data: ob0 } = await c.from('onboarding_responses').select('pushups, pullups').eq('user_id', ctx.userId).maybeSingle()
        const { error } = await c.from('user_skill_progress').insert({
          user_id: ctx.userId,
          skill_id: payload.skill_id,
          level: initialSkillLevel(ob0?.pushups ?? 0, ob0?.pullups ?? 0),
          week_number: 1,
          sessions_at_current_level: 0,
          updated_at: new Date().toISOString(),
        })
        if (error) return fail(`Não consegui adicionar a skill: ${error.message}`)
      }
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
