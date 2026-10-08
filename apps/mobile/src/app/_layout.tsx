import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef } from 'react';

import { ErrorView } from '@/components/ui';
import { useAccount } from '@/lib/account';
import { AuthProvider, useAuth } from '@/lib/auth';
import { queryClient } from '@/lib/query';
import { AppThemeProvider, useTheme, useThemePreference } from '@/theme';

SplashScreen.preventAutoHideAsync();

/**
 * Quem vê o quê:
 *  - sem sessão ............................ login, cadastro, esqueci a senha
 *  - logado, onboarding incompleto ......... onboarding
 *  - logado, trial vencido ................. paywall e telas de conta
 *  - logado, tudo em dia ................... app completo
 * Toda rota precisa estar declarada aqui: rota fora de um Stack.Protected
 * fica acessível para qualquer um.
 */
function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const account = useAccount();
  const c = useTheme();
  const { scheme, setPreference } = useThemePreference();

  const loggedIn = session !== null;
  const waitingAccount = loggedIn && account.isPending;
  const ready = !authLoading && !waitingAccount;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // A preferência salva na conta vale também neste aparelho.
  const savedTheme = account.data?.settings?.preferences.theme;
  useEffect(() => {
    if (savedTheme) setPreference(savedTheme);
  }, [savedTheme, setPreference]);

  // Quem acabou de concluir o onboarding vê os planos uma vez, já dentro do app.
  const onboardingDone = account.data?.onboardingDone;
  const previousDone = useRef(onboardingDone);
  useEffect(() => {
    const justFinished = previousDone.current === false && onboardingDone === true;
    previousDone.current = onboardingDone;
    if (justFinished) requestAnimationFrame(() => router.push('/paywall'));
  }, [onboardingDone]);

  const navTheme = useMemo<Theme>(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: c.primary, background: c.background, card: c.background, text: c.text, border: c.border },
    };
  }, [scheme, c]);

  if (!ready) return null;

  // Falha num refetch com dados em cache não derruba o app (nem um treino em andamento).
  if (loggedIn && account.isError && !account.data) {
    return (
      <ErrorView
        message="Não foi possível carregar sua conta. Confira sua internet."
        onRetry={() => account.refetch()}
      />
    );
  }

  const acc = account.data;
  const inOnboarding = loggedIn && !!acc && !acc.onboardingDone;
  const member = loggedIn && !!acc && acc.onboardingDone;
  const fullAccess = member && !acc.trialExpired;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.background },
          headerTintColor: c.primary,
          headerTitleStyle: { color: c.text, fontWeight: '700' },
          headerStyle: { backgroundColor: c.background },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Protected guard={!loggedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={inOnboarding}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        <Stack.Protected guard={fullAccess}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="treino/[workoutId]" options={{ gestureEnabled: false }} />
          <Stack.Screen name="skill/[skillId]" options={{ headerShown: true, title: '' }} />
          <Stack.Screen name="prs" options={{ headerShown: true, title: 'Recordes pessoais' }} />
          <Stack.Screen name="conquistas" options={{ headerShown: true, title: 'Conquistas' }} />
          <Stack.Screen name="tecnica/[skillId]" options={{ headerShown: true, title: '' }} />
          <Stack.Screen name="ajustes/rotina" options={{ headerShown: true, title: 'Minha rotina' }} />
        </Stack.Protected>

        <Stack.Protected guard={member}>
          <Stack.Screen name="paywall" options={{ presentation: fullAccess ? 'modal' : 'card' }} />
          <Stack.Screen name="ajustes/notificacoes" options={{ headerShown: true, title: 'Notificações' }} />
          <Stack.Screen name="ajustes/preferencias" options={{ headerShown: true, title: 'Preferências' }} />
          <Stack.Screen name="ajustes/assinatura" options={{ headerShown: true, title: 'Planos' }} />
          <Stack.Screen name="ajustes/suporte" options={{ headerShown: true, title: 'Ajuda e suporte' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}
