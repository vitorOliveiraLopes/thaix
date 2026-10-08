import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { CHAT_TOOLS, buildSystemPrompt, type StudentContext, type ChatToolName } from '@/lib/chat-tools'
import { buildActionSummary } from '@/lib/chat-actions'

// ─── Cliente autenticado ──────────────────────────────────────────────────────

async function createAuthClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}

// ─── Montagem do contexto do aluno ────────────────────────────────────────────

async function buildStudentContext(admin: any, userId: string): Promise<StudentContext> {
  const today = new Date().toISOString().split('T')[0]

  const [profileRes, skillProgressRes, onboardingRes, prsRes, todayWorkoutsRes, recentResultsRes] =
    await Promise.all([
      admin.from('profiles').select('name').eq('user_id', userId).maybeSingle(),
      admin.from('user_skill_progress').select('skill_id, level, week_number, sessions_at_current_level').eq('user_id', userId),
      admin.from('onboarding_responses').select('dias_semana').eq('user_id', userId).maybeSingle(),
      admin.from('pr_entries').select('exercise_id, value, unit, date, skill_exercises(exercise_name)').eq('user_id', userId).order('date', { ascending: false }).limit(5),
      admin.from('daily_workouts').select('id, skill_id, completed_at, daily_workout_items(skill_exercises(exercise_name))').eq('user_id', userId).eq('date', today),
      admin.from('daily_workout_results').select('perceived_effort, daily_workouts!inner(user_id, completed_at)').eq('daily_workouts.user_id', userId).not('daily_workouts.completed_at', 'is', null).order('daily_workouts(completed_at)', { ascending: false }).limit(15),
    ])

  const SKILL_NAMES: Record<string, string> = {
    'pull-up': 'Pull-up', 'c2b': 'Chest to Bar', 'bmu': 'Bar Muscle-up',
    't2b': 'Toes-to-Bar', 'hspu': 'HSPU',
  }

  const skills = ((skillProgressRes.data ?? []) as any[]).map(s => ({
    skillName:              SKILL_NAMES[s.skill_id] ?? s.skill_id,
    level:                  s.level,
    weekNumber:             s.week_number,
    sessionsAtCurrentLevel: s.sessions_at_current_level,
  }))

  const effortValues = ((recentResultsRes.data ?? []) as any[])
    .map(r => r.perceived_effort)
    .filter((v: any) => typeof v === 'number')
  const recentAvgEffort = effortValues.length > 0
    ? effortValues.reduce((a: number, b: number) => a + b, 0) / effortValues.length
    : null

  const recentPRs = ((prsRes.data ?? []) as any[]).map(pr => ({
    exerciseName: pr.skill_exercises?.exercise_name ?? 'exercício',
    value:        pr.value,
    unit:         pr.unit,
    date:         pr.date,
  }))

  const todayWorkouts = ((todayWorkoutsRes.data ?? []) as any[]).map(w => ({
    skillName:  SKILL_NAMES[w.skill_id] ?? w.skill_id,
    completed:  !!w.completed_at,
    exercises:  (w.daily_workout_items ?? []).map((i: any) => i.skill_exercises?.exercise_name).filter(Boolean),
  }))

  return {
    name:            profileRes.data?.name ?? null,
    skills,
    recentAvgEffort,
    recentPRs,
    todayWorkouts,
    trainingDays:    onboardingRes.data?.dias_semana ?? [],
  }
}

// ─── Chamada à API da Anthropic ───────────────────────────────────────────────

async function callClaude(systemPrompt: string, history: { role: string; content: string }[]) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-5-5',
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   history,
      tools:      CHAT_TOOLS,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Anthropic API error: ${response.status} ${errText}`)
  }

  return response.json()
}

// ─── POST /api/chat ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const authClient = await createAuthClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const message: string | undefined = body?.message

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })
    }

    // 1. Salvar mensagem do aluno
    await authClient.from('chat_messages').insert({
      user_id: user.id, role: 'user', content: message,
    })

    // 2. Buscar histórico recente (últimas 20 mensagens) para dar continuidade
    const { data: historyRows } = await authClient
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    const history = ((historyRows ?? []) as any[])
      .reverse()
      .map(m => ({ role: m.role, content: m.content }))

    // 3. Montar contexto e chamar o Claude
    const context = await buildStudentContext(authClient, user.id)
    const systemPrompt = buildSystemPrompt(context)
    const claudeResponse = await callClaude(systemPrompt, history)

    // 4. Processar resposta: texto e/ou chamadas de ferramenta
    const textBlocks = (claudeResponse.content ?? []).filter((b: any) => b.type === 'text')
    const toolBlocks  = (claudeResponse.content ?? []).filter((b: any) => b.type === 'tool_use')

    const assistantText = textBlocks.map((b: any) => b.text).join('\n').trim()

    if (assistantText) {
      await authClient.from('chat_messages').insert({
        user_id: user.id, role: 'assistant', content: assistantText,
      })
    }

    // 5. Ferramentas propostas viram ações PENDENTES — nunca gravam direto
    const pendingActions: { id: string; toolName: ChatToolName; summary: string }[] = []

    for (const block of toolBlocks) {
      const toolName = block.name as ChatToolName
      const summary  = buildActionSummary(toolName, block.input)

      const { data: inserted, error } = await authClient
        .from('chat_pending_actions')
        .insert({
          user_id:   user.id,
          tool_name: toolName,
          params:    block.input,
          summary,
          status:    'pending',
        })
        .select('id')
        .single()

      if (!error && inserted) {
        pendingActions.push({ id: inserted.id, toolName, summary })
      }
    }

    return NextResponse.json({
      message:        assistantText || null,
      pendingActions,
    })

  } catch (err) {
    console.error('[POST /api/chat]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
