import { Platform } from 'react-native';

/**
 * Endereço do ThaixSkill na web. O site e a API (rotas em src/app/api) são
 * o mesmo projeto, no mesmo domínio.
 *
 * - Web: o próprio site em que a página está aberta.
 * - Android: EXPO_PUBLIC_SITE_URL (ex.: https://thaix-web-mobile.vercel.app),
 *   fixado no APK na hora do build.
 */
const configured = (process.env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');

export function siteUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return configured;
}
