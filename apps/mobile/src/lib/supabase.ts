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
