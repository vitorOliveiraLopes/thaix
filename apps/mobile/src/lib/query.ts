import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: 0 },
  },
});

// "Foco" no app = voltar para primeiro plano: refaz as queries vencidas.
AppState.addEventListener('change', (status) => {
  if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
});

onlineManager.setOnline(true);

/** Chaves das queries, centralizadas para invalidar com segurança. */
export const qk = {
  account: (userId: string) => ['account', userId] as const,
  onboarding: (userId: string) => ['onboarding', userId] as const,
  home: (userId: string) => ['home', userId] as const,
  todayWorkouts: (userId: string, date: string) => ['today-workouts', userId, date] as const,
  workout: (workoutId: string) => ['workout', workoutId] as const,
  progress: (userId: string) => ['progress', userId] as const,
  skillProgress: (userId: string) => ['skill-progress', userId] as const,
  skillHistory: (userId: string, skillId: string) => ['skill-history', userId, skillId] as const,
  prs: (userId: string) => ['prs', userId] as const,
  achievements: (userId: string) => ['achievements', userId] as const,
  courses: (userId: string) => ['courses', userId] as const,
  course: (userId: string, skillId: string) => ['course', userId, skillId] as const,
  chat: (userId: string) => ['chat', userId] as const,
};
