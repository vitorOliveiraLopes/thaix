import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { queryClient } from './query';
import { supabase } from './supabase';
import { setMonitoringUser } from './monitoring';
import { authRedirectUrl } from './auth-links';

type AuthResult = { error: string | null };

type AuthState = {
  session: Session | null;
  /** true até a sessão salva no aparelho ser lida pela primeira vez. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult & { needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthState | null>(null);

/** Traduz os erros mais comuns do Supabase Auth para mensagens úteis ao aluno. */
/** Mínimo de caracteres da senha (o mesmo do Supabase Auth). */
export const MIN_PASSWORD = 6;

export function authErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (m.includes('already registered')) return 'Já existe uma conta com esse e-mail. Tente entrar.';
  if (m.includes('password should be at least')) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  if (m.includes('should be different')) return 'A senha nova precisa ser diferente da anterior.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  if (m.includes('network') || m.includes('fetch')) return 'Sem conexão com o servidor. Confira sua internet.';
  return 'Não foi possível concluir. Tente de novo em instantes.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setMonitoringUser(data.session?.user.id ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setMonitoringUser(next?.user.id ?? null);
      // Dados em cache são do aluno anterior: nunca mostrar para outra conta.
      if (event === 'SIGNED_OUT') queryClient.clear();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    session,
    loading,

    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return { error: error ? authErrorMessage(error.message) : null };
    },

    async signUp(name, email, password) {
      // full_name é lido pelo trigger handle_new_user para criar o profile.
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // O link de confirmação volta para o login do app (ou do site).
        options: { data: { full_name: name.trim() }, emailRedirectTo: authRedirectUrl('/login') },
      });
      return {
        error: error ? authErrorMessage(error.message) : null,
        needsConfirmation: !error && !data.session,
      };
    },

    async signOut() {
      await supabase.auth.signOut();
      queryClient.clear();
    },

    async resetPassword(email) {
      // O link do e-mail abre a tela de nova senha do próprio app.
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authRedirectUrl('/redefinir-senha'),
      });
      return { error: error ? authErrorMessage(error.message) : null };
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return ctx;
}
