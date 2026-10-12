import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { secureStorage } from './secure-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copie apps/mobile/.env.example para .env.local, preencha e reinicie o "npx expo start".',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No celular não há URL de onde ler a sessão.
    detectSessionInUrl: false,
  },
});

// O refresh automático só deve rodar com o app em primeiro plano.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/**
 * Cliente avulso, sem guardar sessão: usado para trocar a senha com a sessão
 * de recuperação do link do e-mail sem logar o app no meio do caminho.
 */
export function createIsolatedClient() {
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
