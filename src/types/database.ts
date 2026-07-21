// ─── ThaixSkill — Tipos do banco de dados ────────────────────────────────────
// Alinhados com o schema real do Supabase (verificado em julho 2026)

export type Profile = {
  id: string
  user_id: string
  name: string | null           // coluna real: 'name' (não 'full_name')
  email: string | null
  avatar_url: string | null
  weight_kg: number | null
  height_cm: number | null
  hydration_goal_ml: number | null
  workout_reminder_time: string | null
  hydration_reminder_time: string | null
  created_at: string
  updated_at: string
}

export type UserSettings = {
  id: string
  user_id: string
  // Fonte de verdade para horários e toggles de notificação
  notifications: {
    workout:   { time: string; enabled: boolean }
    hydration: { time: string; enabled: boolean }
  }
  preferences: {
    theme:       'light' | 'dark' | 'system'
    weightUnit:  'kg' | 'lb'
    captions:    boolean
    fontSize:    'default' | 'large' | 'xlarge'
  }
  subscription_status:  'trial' | 'active' | 'cancelled' | 'none'
  subscription_plan:    string | null
  trial_ends_at:        string | null
  renewal_date:         string | null
  created_at:           string
  updated_at:           string
}

// achievement.type possíveis:
//   'session_count' — desbloqueado ao atingir N treinos concluídos
//   'skill_exercise' — desbloqueado ao executar um exercício pela primeira vez
//   'skill_level'   — desbloqueado ao avançar de nível numa skill
export type Achievement = {
  id: string
  type: 'session_count' | 'skill_exercise' | 'skill_level'
  name: string
  description: string | null
  threshold: number | null
  skill_exercise_id: string | null
  skill_id: string | null
  target_level: string | null
  display_type: string
}

export type OnboardingData = {
  motivacao: string | null
  objetivo: string | null
  pushups: number
  pullups: number
  squats: number
  recommendedProtocol: string | null
  dias_semana: number[]
}
