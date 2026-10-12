import * as Linking from 'expo-linking';

import { siteUrl } from './site';

/**
 * Para onde o link do e-mail (nova senha, confirmação de cadastro) leva: o
 * site, que abre em qualquer aparelho, inclusive se o e-mail for aberto no
 * computador. Sem o endereço do site configurado (desenvolvimento no
 * Android), o link do app (thaixskill://), que só funciona no celular.
 */
export function authRedirectUrl(path: string): string {
  const site = siteUrl();
  return site ? `${site}${path}` : Linking.createURL(path);
}
