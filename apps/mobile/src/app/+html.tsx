import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Molde do HTML do site (só web; roda no build, não no navegador).
 * Em pt-BR, com o ícone e o modo "app" ao adicionar à tela de início.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>ThaixSkill</title>
        <meta name="description" content="Treino de skills de ginástica para CrossFit, com a Coach Thaís." />
        {/* iPhone: "Adicionar à Tela de Início" abre como app, sem a barra do Safari. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="ThaixSkill" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <noscript>Ative o JavaScript para usar o ThaixSkill.</noscript>
        {children}
      </body>
    </html>
  );
}

const css = `
body { overflow: hidden; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
`;
