import * as SecureStore from 'expo-secure-store';

/**
 * Adaptador de armazenamento para o Supabase Auth usando o Keychain (iOS)
 * e o Keystore (Android).
 *
 * O SecureStore avisa (e em alguns aparelhos falha) com valores acima de
 * ~2 KB, e a sessão do Supabase costuma passar disso. Então o valor é
 * dividido em pedaços: `<chave>` guarda quantos pedaços existem e
 * `<chave>.<n>` guarda cada um.
 */

const CHUNK_SIZE = 1800;

// O SecureStore só aceita [A-Za-z0-9._-] em chaves; o Supabase usa "sb-<ref>-auth-token".
function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

async function removeChunks(base: string, from: number, to: number) {
  for (let i = from; i < to; i++) {
    await SecureStore.deleteItemAsync(`${base}.${i}`);
  }
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const base = safeKey(key);
    const countRaw = await SecureStore.getItemAsync(base);
    if (countRaw === null) return null;

    const count = Number(countRaw);
    if (!Number.isInteger(count) || count < 0) return null;

    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${base}.${i}`);
      if (part === null) return null; // gravação incompleta: trata como sem sessão
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const base = safeKey(key);
    const previous = Number((await SecureStore.getItemAsync(base)) ?? 0);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${base}.${i}`, chunks[i]);
    }
    await SecureStore.setItemAsync(base, String(chunks.length));

    if (Number.isInteger(previous) && previous > chunks.length) {
      await removeChunks(base, chunks.length, previous);
    }
  },

  async removeItem(key: string): Promise<void> {
    const base = safeKey(key);
    const count = Number((await SecureStore.getItemAsync(base)) ?? 0);
    await SecureStore.deleteItemAsync(base);
    if (Number.isInteger(count)) await removeChunks(base, 0, count);
  },
};
