/**
 * Web: sessão do Supabase no localStorage do navegador (não há Keychain nem
 * Keystore). Em aba anônima ou com armazenamento bloqueado, o acesso pode
 * falhar: aí a sessão vale só enquanto a página estiver aberta.
 */
const memory = new Map<string, string>();

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return storage()?.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    memory.set(key, value);
    try {
      storage()?.setItem(key, value);
    } catch {
      // cota cheia ou bloqueado: fica só em memória
    }
  },
  async removeItem(key: string): Promise<void> {
    memory.delete(key);
    try {
      storage()?.removeItem(key);
    } catch {
      // ignora
    }
  },
};
