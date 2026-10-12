import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/+$/, '');

/**
 * Para onde o link do e-mail (nova senha, confirmação de cadastro) leva.
 *
 * - Na web: o próprio site.
 * - No Android: o site (EXPO_PUBLIC_WEB_URL), que abre em qualquer aparelho,
 *   inclusive se o e-mail for aberto no computador. Sem ele configurado, o
 *   link do app (thaixskill://), que só funciona no celular com o app.
 */
export function authRedirectUrl(path: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}${path}`;
  if (WEB_URL) return `${WEB_URL}${path}`;
  return Linking.createURL(path);
}
