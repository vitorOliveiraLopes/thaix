# ThaixSkill — app (Expo)

App iOS e Android do ThaixSkill, feito com Expo SDK 57 e Expo Router.
As regras de treino vêm do pacote `@thaix/core` (`packages/core`), o mesmo que a API usa.

## Rodar no seu celular (Windows, CMD)

1. Instale o **Expo Go** no celular (App Store ou Play Store).
2. Crie o arquivo de ambiente, a partir da raiz do repositório:

   ```cmd
   cd apps\mobile
   copy .env.example .env.local
   ```

   Abra `.env.local` e cole a **anon key** do Supabase (Project Settings → API).
   Nunca coloque a service role aqui: tudo que tem `EXPO_PUBLIC_` vai dentro do app.

3. Instale e inicie:

   ```cmd
   npm install
   npx expo start
   ```

4. Leia o QR code com a câmera (iPhone) ou com o Expo Go (Android).
   O celular e o PC precisam estar na mesma rede Wi-Fi. Se não conectar, use `npx expo start --tunnel`.

## Comandos úteis

| Comando | O que faz |
|---|---|
| `npx expo start -c` | Inicia limpando o cache (use depois de mexer no `packages/core` ou no `.env.local`) |
| `npm run typecheck` | Checa os tipos |
| `npm run lint` | Lint |

## Por que o app não está nos workspaces da raiz

A raiz ainda é o Next.js, que usa outra versão do React. Duas versões de React no mesmo
`node_modules` quebram o app, então o `apps/mobile` tem o próprio `node_modules` e recebe
o core por link (`"@thaix/core": "file:../../packages/core"`). O `metro.config.js` observa
a pasta do core. Quando o Next virar `apps/api`, tudo passa a ser workspace.

## Sessão do usuário

A sessão do Supabase fica no Keychain/Keystore (`expo-secure-store`), dividida em pedaços
porque o SecureStore limita o tamanho de cada valor. Ver `src/lib/secure-storage.ts`.
