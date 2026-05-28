export type Protocol = {
  id: string
  name: string
  description: string
  order_index: number
  available: boolean
}

export type Phase = {
  id: string
  protocol_id: string
  phase_number: number
  name: string
  subtitle: string | null
  description: string | null
  requires_test: boolean
}

export type Exercise = {
  id: string
  name: string
  category: 'Aquecimento' | 'Força' | 'Skill' | 'Core' | 'Mobilidade'
  demo_video_url: string | null
  loop_video_url: string | null
  image_url: string | null
}

export type Session = {
  id: string
  phase_id: string
  day_number: number
  title: string
  estimated_minutes: number
  image_url: string | null
}

export type SessionItem = {
  id: string
  session_id: string
  exercise_id: string
  order_index: number
  sets: number
  reps: number | null
  time_sec: number | null
  note: string | null
  exercise?: Exercise
}

export type UserProgress = {
  id: string
  user_id: string
  active_protocol_id: string
  current_phase_id: string
  current_day_number: number
  completed_session_ids: string[]
  last_session_completed_at: string | null
}

export type UserSettings = {
  id: string
  user_id: string
  notifications: {
    workout: { time: string; enabled: boolean }
    hydration: { time: string; enabled: boolean }
  }
  preferences: {
    theme: 'light' | 'dark' | 'system'
    weightUnit: 'kg' | 'lb'
    captions: boolean
    fontSize: 'default' | 'large' | 'xlarge'
  }
  subscription_status: 'trial' | 'active' | 'cancelled' | 'none'
  subscription_plan: string
  trial_ends_at: string | null
}

export type Profile = {
  id: string
  user_id: string
  name: string | null
  email: string | null
  avatar_url: string | null
  weight_kg: number | null
  height_cm: number | null
}

export type Achievement = {
  id: string
  type: 'session_count' | 'exercise'
  name: string
  description: string | null
  threshold: number | null
  exercise_id: string | null
  display_type: string
}

export type OnboardingData = {
  motivacao: string | null
  objetivo: string | null
  pushups: number
  pullups: number
  squats: number
  recommendedProtocol: string | null
}