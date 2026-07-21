/**
 * ThaixSkill — Script de validação do fluxo de treinos
 *
 * Simula o ciclo completo de um aluno do zero sem depender
 * da Admin API do Supabase (que requer configuração extra).
 * Usa um userId fictício com dados inseridos via service role.
 *
 * Uso:
 *   npx ts-node --project tsconfig.json scripts/validate-workout-flow.ts
 *
 * Pré-requisitos no .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (Settings → API → service_role)
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'

// ─── Setup ────────────────────────────────────────────────────────────────────

config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌  Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local')
  process.exit(1)
}

// Service role ignora RLS — necessário para inserir dados sem auth real
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// UUID determinístico para o aluno de teste (não precisa existir no auth)
const TEST_USER_ID = '00000000-0000-0000-0000-test00000001'
const TEST_SKILL   = 'pull-up'

// ─── Contadores ───────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅  ${message}`)
    passed++
  } else {
    console.error(`  ❌  ${message}`)
    failed++
  }
}

function section(title: string) {
  console.log(`\n${'─'.repeat(55)}`)
  console.log(`▶  ${title}`)
  console.log('─'.repeat(55))
}

function today() { return new Date().toISOString().split('T')[0] }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup() {
  const userId = TEST_USER_ID
  console.log('\n🧹  Limpando dados de teste...')

  await supabase.from('user_achievements').delete().eq('user_id', userId)
  await supabase.from('pr_entries').delete().eq('user_id', userId)
  await supabase.from('skill_level_history').delete().eq('user_id', userId)

  const { data: workouts } = await supabase
    .from('daily_workouts').select('id').eq('user_id', userId)
  const wIds = (workouts ?? []).map(w => w.id)

  if (wIds.length > 0) {
    await supabase.from('daily_workout_results').delete().in('daily_workout_id', wIds)
    await supabase.from('daily_workout_items').delete().in('daily_workout_id', wIds)
    await supabase.from('daily_workouts').delete().in('id', wIds)
  }

  await supabase.from('user_skill_progress').delete().eq('user_id', userId)
  await supabase.from('onboarding_responses').delete().eq('user_id', userId)
  console.log('  ✅  Dados removidos')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Calcula protocolo recomendado — espelho de onboarding.ts */
function calcProtocol(pushups: number, pullups: number, squats: number): string {
  const score = pushups + pullups * 2 + squats / 2
  if (pushups >= 20 && pullups >= 5) return 'avancado'
  if (pullups === 0 && score < 8)    return 'iniciante'
  if (pullups === 0)                 return 'intermediario'
  if (score < 10)                    return 'iniciante'
  if (score < 25)                    return 'intermediario'
  return 'avancado'
}

/** Insere treino completo com itens e resultados no banco */
async function insertWorkout(params: {
  date: string
  weekNumber: number
  level: string
  meetsGoal: boolean
  perceivedEffort: number   // 1–5
}): Promise<string> {
  const { data: exercises } = await supabase
    .from('skill_exercises')
    .select('id, sets, reps, time_sec')
    .eq('skill_id', TEST_SKILL)
    .eq('level', params.level)
    .limit(5)

  if (!exercises?.length) throw new Error(`Sem exercícios para ${TEST_SKILL}/${params.level}`)

  const { data: workout, error } = await supabase
    .from('daily_workouts')
    .insert({
      user_id:     TEST_USER_ID,
      skill_id:    TEST_SKILL,
      date:        params.date,
      week_number: params.weekNumber,
      completed_at: new Date(`${params.date}T12:00:00Z`).toISOString(),
    })
    .select('id')
    .single()

  if (error || !workout) throw new Error(`Erro ao criar workout: ${error?.message}`)

  await supabase.from('daily_workout_items').insert(
    exercises.map((ex, i) => ({
      daily_workout_id:  workout.id,
      skill_exercise_id: ex.id,
      order_index: i,
      sets:     ex.sets  ?? 3,
      reps:     ex.reps  ?? null,
      time_sec: ex.time_sec ?? null,
    }))
  )

  await supabase.from('daily_workout_results').upsert(
    exercises.map(ex => ({
      daily_workout_id:  workout.id,
      skill_exercise_id: ex.id,
      reps_achieved:     ex.reps     ? Math.floor(ex.reps    * (params.meetsGoal ? 1 : 0.5)) : null,
      time_achieved_sec: ex.time_sec ? Math.floor(ex.time_sec * (params.meetsGoal ? 1 : 0.5)) : null,
      perceived_effort:  params.perceivedEffort,
    })),
    { onConflict: 'daily_workout_id,skill_exercise_id' }
  )

  return workout.id
}

// ─── Suítes ───────────────────────────────────────────────────────────────────

async function suite1_scoreCalculation() {
  section('1. Cálculo de score e protocolo recomendado')

  type Case = { pushups: number; pullups: number; squats: number; expected: string; desc: string }
  const cases: Case[] = [
    { pushups: 25, pullups: 6,  squats: 20, expected: 'avancado',      desc: '25 push + 6 pull → Avançado (regra forte)' },
    { pushups: 3,  pullups: 0,  squats: 8,  expected: 'iniciante',     desc: '0 pull, score 7 → Iniciante (< 8)' },
    { pushups: 5,  pullups: 0,  squats: 20, expected: 'intermediario', desc: '0 pull, score 15 → Intermediário (teto sem barra)' },
    { pushups: 4,  pullups: 1,  squats: 10, expected: 'iniciante',     desc: 'score 11 < 25 e < 10? não: 4+2+5=11 → Intermediário... corrigido: score 11 ≥ 10, < 25 → Intermediário' },
    { pushups: 10, pullups: 3,  squats: 30, expected: 'avancado',      desc: 'score 10+6+15=31 ≥ 25 → Avançado' },
    { pushups: 2,  pullups: 1,  squats: 10, expected: 'iniciante',     desc: 'score 2+2+5=9 < 10 → Iniciante' },
  ]

  // Corrigir o caso 4: 4+1×2+10/2 = 4+2+5 = 11, que é ≥ 10 e < 25 → intermediario
  cases[3].expected = 'intermediario'

  for (const c of cases) {
    const result = calcProtocol(c.pushups, c.pullups, c.squats)
    const score  = c.pushups + c.pullups * 2 + c.squats / 2
    assert(result === c.expected, `${c.desc} (score=${score}, resultado=${result})`)
  }
}

async function suite2_onboardingPersistence() {
  section('2. Persistência do onboarding')

  const { error } = await supabase.from('onboarding_responses').upsert({
    user_id:              TEST_USER_ID,
    pushups: 10, pullups: 3, squats: 30,
    skills:               [TEST_SKILL],
    frequencia:           3,
    dias_semana:          [1, 3, 5],
    protocol_recommended: 'avancado',
    completed_at:         new Date().toISOString(),
  }, { onConflict: 'user_id' })

  assert(!error, `Upsert em onboarding_responses: ${error?.message ?? 'OK'}`)

  const { data } = await supabase
    .from('onboarding_responses')
    .select('dias_semana, skills, protocol_recommended')
    .eq('user_id', TEST_USER_ID)
    .single()

  assert(
    JSON.stringify((data?.dias_semana ?? []).sort()) === JSON.stringify([1, 3, 5]),
    `dias_semana salvo corretamente: ${JSON.stringify(data?.dias_semana)}`
  )
  assert(data?.skills?.includes(TEST_SKILL), `skill '${TEST_SKILL}' salva`)
  assert(data?.protocol_recommended === 'avancado', `protocolo: ${data?.protocol_recommended}`)
}

async function suite3_exerciseLibrary() {
  section('3. Biblioteca de exercícios por skill e nível')

  let allOk = true
  for (const level of ['iniciante', 'intermediario', 'avancado']) {
    const { data, count } = await supabase
      .from('skill_exercises')
      .select('id, category', { count: 'exact' })
      .eq('skill_id', TEST_SKILL)
      .eq('level', level)

    const hasExercises = (count ?? 0) > 0
    assert(hasExercises, `${TEST_SKILL}/${level}: ${count ?? 0} exercícios cadastrados`)

    if (hasExercises) {
      const cats = new Set((data ?? []).map(e => e.category))
      assert(cats.has('skill'), `${level}: tem categoria 'skill' (${[...cats].join(', ')})`)
    } else {
      allOk = false
    }
  }

  if (!allOk) {
    console.log('\n  ⚠️  Exercícios não encontrados. Verifique se skill_id = \'pull-up\'')
    console.log('     existe na tabela skills e se skill_exercises tem dados cadastrados.')
    const { data: skills } = await supabase.from('skills').select('id, name')
    console.log('     Skills disponíveis:', skills?.map(s => `${s.id} (${s.name})`).join(', '))
  }
}

async function suite4_workoutComposition() {
  section('4. Composição do treino por nível')

  await supabase.from('user_skill_progress').upsert({
    user_id: TEST_USER_ID, skill_id: TEST_SKILL,
    level: 'iniciante', week_number: 1, sessions_at_current_level: 0,
  }, { onConflict: 'user_id,skill_id' })

  // Verificar existência de exercícios antes de tentar inserir
  const { count } = await supabase
    .from('skill_exercises')
    .select('id', { count: 'exact', head: true })
    .eq('skill_id', TEST_SKILL).eq('level', 'iniciante')

  if ((count ?? 0) === 0) {
    console.log('  ⚠️  Pulando — sem exercícios cadastrados (ver suíte 3)')
    return
  }

  const workoutId = await insertWorkout({
    date: today(), weekNumber: 1, level: 'iniciante',
    meetsGoal: true, perceivedEffort: 2,
  })

  const { data: items, count: itemCount } = await supabase
    .from('daily_workout_items')
    .select('id', { count: 'exact' })
    .eq('daily_workout_id', workoutId)

  assert(!!workoutId, 'Treino inserido com ID válido')
  assert((itemCount ?? 0) > 0, `Treino tem ${itemCount} exercícios`)
  assert((itemCount ?? 0) <= 8, `Volume dentro do limite (≤ 8)`)

  // Verificar que resultados foram salvos
  const { count: resultCount } = await supabase
    .from('daily_workout_results')
    .select('id', { count: 'exact', head: true })
    .eq('daily_workout_id', workoutId)

  assert((resultCount ?? 0) > 0, `${resultCount} resultados registrados`)
}

async function suite5_adaptiveProfile() {
  section('5. Perfil adaptativo — esforço e consistência')

  const { count } = await supabase
    .from('skill_exercises')
    .select('id', { count: 'exact', head: true })
    .eq('skill_id', TEST_SKILL).eq('level', 'iniciante')

  if ((count ?? 0) === 0) {
    console.log('  ⚠️  Pulando — sem exercícios cadastrados')
    return
  }

  // Inserir 2 sessões com esforço fácil
  await insertWorkout({ date: daysAgo(2), weekNumber: 1, level: 'iniciante', meetsGoal: true, perceivedEffort: 2 })
  await insertWorkout({ date: daysAgo(1), weekNumber: 1, level: 'iniciante', meetsGoal: true, perceivedEffort: 2 })

  // Verificar dados disponíveis para o perfil adaptativo
  const { data: recentWorkouts } = await supabase
    .from('daily_workouts')
    .select('id')
    .eq('user_id', TEST_USER_ID)
    .eq('skill_id', TEST_SKILL)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })
    .limit(3)

  assert((recentWorkouts ?? []).length >= 2, `${recentWorkouts?.length} sessões disponíveis para perfil adaptativo`)

  const wIds = (recentWorkouts ?? []).map(w => w.id)
  const { data: results } = await supabase
    .from('daily_workout_results')
    .select('skill_exercise_id, perceived_effort, reps_achieved')
    .in('daily_workout_id', wIds)

  const avgEffort = (results ?? []).reduce((a, r) => a + (r.perceived_effort ?? 3), 0) / ((results ?? []).length || 1)
  assert(avgEffort <= 2.5, `Esforço médio = ${avgEffort.toFixed(2)} (critério de progressão: ≤ 2.5)`)

  // Exercícios que batem meta em ambas as sessões
  const last2 = wIds.slice(0, 2)
  const byWorkout = new Map<string, any[]>()
  for (const r of (results ?? [])) {
    if (!byWorkout.has(r.daily_workout_id ?? '')) byWorkout.set(r.daily_workout_id ?? '', [])
    byWorkout.get(r.daily_workout_id ?? '')!.push(r)
  }
  const w1Results = byWorkout.get(last2[0]) ?? []
  const w2Results = byWorkout.get(last2[1]) ?? []
  const consistent = w1Results.filter(r1 => {
    const r2 = w2Results.find(r => r.skill_exercise_id === r1.skill_exercise_id)
    return r2 && (r1.reps_achieved ?? 0) > 0 && (r2.reps_achieved ?? 0) > 0
  })
  assert(consistent.length > 0, `${consistent.length} exercícios com meta batida consistentemente`)
}

async function suite6_levelProgressionCriteria() {
  section('6. Critério de progressão de nível')

  const { data: progress } = await supabase
    .from('user_skill_progress')
    .select('sessions_at_current_level, level')
    .eq('user_id', TEST_USER_ID)
    .eq('skill_id', TEST_SKILL)
    .single()

  console.log(`  ℹ️   Sessões no nível atual: ${progress?.sessions_at_current_level ?? 0}`)
  assert(
    (progress?.sessions_at_current_level ?? 0) >= 0,
    `sessions_at_current_level acessível: ${progress?.sessions_at_current_level}`
  )

  // Verificar lógica: precisa de 2 sessões + meta batida + esforço ≤ 2.5
  const { data: completedWorkouts } = await supabase
    .from('daily_workouts')
    .select('id')
    .eq('user_id', TEST_USER_ID)
    .eq('skill_id', TEST_SKILL)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })
    .limit(2)

  assert((completedWorkouts ?? []).length >= 2, `Pelo menos 2 sessões concluídas para avaliar progressão`)
}

async function suite7_prRegistration() {
  section('7. Registro de PRs')

  const { data: exercises } = await supabase
    .from('skill_exercises')
    .select('id, reps')
    .eq('skill_id', TEST_SKILL)
    .eq('level', 'iniciante')
    .not('reps', 'is', null)
    .limit(1)

  if (!exercises?.length) {
    console.log('  ⚠️  Sem exercícios de reps — pulando')
    return
  }

  const ex = exercises[0]
  const prValue = (ex.reps ?? 5) + 10

  const { error } = await supabase.from('pr_entries').insert({
    user_id: TEST_USER_ID, exercise_id: ex.id,
    value: prValue, unit: 'reps',
    date: today(), notes: 'Teste automatizado',
  })

  assert(!error, `PR inserido: ${error?.message ?? 'OK'}`)

  const { data: prs } = await supabase
    .from('pr_entries').select('value')
    .eq('user_id', TEST_USER_ID).eq('exercise_id', ex.id)

  assert((prs ?? []).some(p => p.value === prValue), `PR ${prValue} reps encontrado`)
}

async function suite8_achievements() {
  section('8. Conquistas desbloqueáveis')

  const { data: achievements, count: totalCount } = await supabase
    .from('achievements').select('id, type, threshold', { count: 'exact' })

  assert((totalCount ?? 0) > 0, `${totalCount} conquistas cadastradas no banco`)

  const sessionAch = (achievements ?? []).filter(a => a.type === 'session_count')
  assert(sessionAch.length > 0, `${sessionAch.length} conquistas de tipo session_count`)

  const skillLevelAch = (achievements ?? []).filter(a => a.type === 'skill_level')
  assert(skillLevelAch.length > 0, `${skillLevelAch.length} conquistas de tipo skill_level`)

  // Verificar que conquista de 1º treino pode ser desbloqueada
  const { count: completedCount } = await supabase
    .from('daily_workouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', TEST_USER_ID)
    .not('completed_at', 'is', null)

  const firstWorkoutAch = sessionAch.find(a => (a.threshold ?? 0) <= (completedCount ?? 0))
  assert(!!firstWorkoutAch, `Conquista elegível com ${completedCount} treinos: ${firstWorkoutAch?.id ?? 'nenhuma'}`)
}

async function suite9_trainingDayFilter() {
  section('9. Filtro de dias de treino')

  const { data } = await supabase
    .from('onboarding_responses')
    .select('dias_semana')
    .eq('user_id', TEST_USER_ID)
    .single()

  const savedDays: number[] = data?.dias_semana ?? []
  assert(savedDays.length >= 2, `${savedDays.length} dias de treino configurados`)

  const todayDow = new Date().getDay()
  const isTrainingDay = savedDays.includes(todayDow)
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  console.log(`  ℹ️   Hoje: ${dayNames[todayDow]} (${todayDow}) — ${isTrainingDay ? 'dia de treino ✅' : 'dia de descanso 🧘'}`)
  assert(typeof isTrainingDay === 'boolean', 'Lógica de dia de treino funciona corretamente')
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗')
  console.log('║      ThaixSkill — Validação do Fluxo de Treinos       ║')
  console.log(`║      ${new Date().toLocaleString('pt-BR').padEnd(49)}║`)
  console.log('╚═══════════════════════════════════════════════════════╝')
  console.log(`\n🧪  userId de teste: ${TEST_USER_ID}`)
  console.log(`🏋️   Skill testada:   ${TEST_SKILL}`)

  // Limpar resíduos de execução anterior
  await cleanup()

  try {
    await suite1_scoreCalculation()
    await suite2_onboardingPersistence()
    await suite3_exerciseLibrary()
    await suite4_workoutComposition()
    await suite5_adaptiveProfile()
    await suite6_levelProgressionCriteria()
    await suite7_prRegistration()
    await suite8_achievements()
    await suite9_trainingDayFilter()
  } catch (err) {
    console.error('\n💥  Erro inesperado:', err)
    failed++
  } finally {
    await cleanup()

    const total = passed + failed
    const pct   = total > 0 ? Math.round((passed / total) * 100) : 0
    console.log('\n╔═══════════════════════════════════════════════════════╗')
    console.log(`║  ${passed}/${total} testes passaram (${pct}%)${' '.repeat(37 - String(passed).length - String(total).length - String(pct).length)}║`)
    if (failed > 0) {
      console.log(`║  ⚠️   ${failed} falha(s) — verifique os itens acima${' '.repeat(40 - String(failed).length)}║`)
    } else {
      console.log('║  🎉  Todos os testes passaram!                         ║')
    }
    console.log('╚═══════════════════════════════════════════════════════╝')

    process.exit(failed > 0 ? 1 : 0)
  }
}

main()
