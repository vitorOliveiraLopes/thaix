# ThaixSkill — app (Expo)

App Android, site e API do ThaixSkill num projeto só, feito com Expo SDK 57 e Expo Router.
As regras de treino vêm do pacote `@thaix/core` (`packages/core`).

- **Telas:** `src/app/**` (Android e web, mesmo código).
- **API:** `src/app/api/**/*+api.ts` (rotas de API do Expo Router) e `src/server/**`
  (coach, autenticação, monitoramento). Roda só no servidor; telas nunca importam `src/server`.

## Antes do primeiro teste

1. **Rode o SQL novo no Supabase** (SQL Editor): `supabase/sql/add_onboarding_routine_fields.sql`.
   Ele cria `session_minutes` e `equipment` em `onboarding_responses`. Sem ele o onboarding não salva.
2. **Crie o `.env.local`** a partir da raiz do repositório:

   ```cmd
   cd apps\mobile
   copy .env.example .env.local
   ```

   Preencha a **anon key** do Supabase e `EXPO_PUBLIC_SITE_URL` (endereço do site, que também
   é o da API). Para testar o coach localmente, preencha também `ANTHROPIC_API_KEY`.
   Nunca coloque a service role aqui: tudo com `EXPO_PUBLIC_` vai dentro do app.

## Rodar no celular (Windows, CMD)

```cmd
npm install
npx expo start
```

Leia o QR code com a câmera (iPhone) ou com o Expo Go (Android). Se não conectar, use `npx expo start --tunnel`.
Com `w` (ou `npx expo start --web`) abre o site em http://localhost:8081, já com a API.

## Gerar um APK para instalar no Android (EAS Build)

O build roda na nuvem do Expo (plano gratuito). O `.env.local` **não** é enviado
(está no .gitignore), então as variáveis ficam no EAS, no ambiente `preview`.
São todas públicas (`EXPO_PUBLIC_*`), nenhum segredo vai no app.

Uma vez só (CMD, dentro de `apps\mobile`):

```cmd
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://SEU-PROJETO.supabase.co --visibility plaintext
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value SUA_CHAVE_ANON --visibility plaintext
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SITE_URL --value https://thaix-web-mobile.vercel.app --visibility plaintext
```

`init` cria o projeto no expo.dev e grava o `projectId` no `app.json` (commitar essa mudança).

A cada APK novo:

```cmd
npx eas-cli@latest build --platform android --profile preview
```

No fim, o terminal mostra um link e um QR code. Abra no celular, baixe o APK e
instale (o Android pede para permitir "instalar apps desta fonte").

- O APK não precisa do PC ligado nem do Expo Go: é o app de verdade.
- Mudança só em JavaScript exige um APK novo (ou EAS Update, quando configurarmos).
- `production` gera o pacote para a Play Store (.aab); fica para o lançamento.

## Versão web (mesmo código)

O mesmo app roda no navegador (react-native-web). Diferenças ficam em
arquivos `.web.tsx`/`.web.ts` ao lado do original (teclado, armazenamento da
sessão, seletor de horário) e em `Platform.OS === 'web'` (vibração,
confirmações, moldura centralizada no computador).

Rodar localmente: `npx expo start --web` (abre em http://localhost:8081, com a API).

O site é gerado com `web.output: "server"`: o HTML de cada página sai no build e o app só
desenha no navegador (a sessão fica no `localStorage`), como um app de página única.

### Publicar na Vercel (um projeto: site + API)

1. Projeto com o mesmo repositório e **Root Directory = `apps/mobile`**. O `vercel.json`
   desta pasta define tudo: build (`npx expo export -p web`), arquivos estáticos
   (`dist/client`) e a função `api/index.js`, que atende as rotas de API e as páginas.
2. Variáveis do projeto:

   | Variável | Para quê |
   |---|---|
   | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase (chave pública), no site e na API |
   | `ANTHROPIC_API_KEY` | Coach (secreta, só servidor) |
   | `COACH_MODEL`, `COACH_DAILY_LIMIT` | Modelo e limite diário de mensagens (opcionais) |
   | `SENTRY_DSN` | Erros da API (opcional) |
   | `EXPO_PUBLIC_SENTRY_DSN` | Erros do site (opcional) |

   O site não precisa de `EXPO_PUBLIC_SITE_URL` (usa o próprio endereço) nem de CORS.
3. A nova senha é feita no próprio app (tela `/redefinir-senha`, no Android e na web).
   Cadastre `https://SEU-SITE/redefinir-senha` e `https://SEU-SITE/login` em
   **Supabase → Authentication → URL Configuration → Redirect URLs**.

## Monitoramento de erros (Sentry)

- **App (Android e web):** `EXPO_PUBLIC_SENTRY_DSN` no `.env.local`, no ambiente do EAS
  (`eas env:create --environment preview --name EXPO_PUBLIC_SENTRY_DSN ...`) e no projeto web
  da Vercel. Só liga fora do modo de desenvolvimento e envia apenas o id do aluno.
- **API:** `SENTRY_DSN` no projeto da Vercel (envio direto ao Sentry, sem SDK; nunca manda o
  conteúdo das mensagens nem o token).
- No Android, o Sentry é uma biblioteca nativa: precisa de um APK novo.

## Estrutura

```
src/
├─ app/                      Rotas (Expo Router). Cada arquivo é uma tela.
│  ├─ _layout.tsx            Providers e quem vê o quê (login, onboarding, paywall, app)
│  ├─ (auth)/                Login, cadastro, esqueci a senha
│  ├─ onboarding/            8 telas, retoma de onde parou
│  ├─ (tabs)/                Início, Desempenho, Técnicas, Coach, Perfil
│  ├─ treino/[workoutId]     Execução do treino (séries, timer, esforço)
│  ├─ skill/, prs, conquistas, tecnica/, ajustes/, paywall
│  ├─ api/                   Rotas de API: chat, confirmação de ações, conclusão de treino
│  └─ +html.tsx              Molde do HTML do site
├─ server/                   Só servidor: coach (modelo, ferramentas, contexto), auth, Sentry
├─ components/               UI reutilizável (ui, inputs, sets, workouts, charts...)
├─ lib/                      Dados: Supabase, API, React Query e hooks por assunto
api/index.js                 Função da Vercel que serve o build do servidor
└─ theme.tsx                 Cores da marca, claro/escuro, tipografia
```

Regras de negócio não ficam aqui: ficam no `packages/core`, com testes (`npm test` na raiz).

## Comandos

| Comando | O que faz |
|---|---|
| `npx expo start -c` | Inicia limpando o cache (use depois de mexer no `packages/core` ou no `.env.local`) |
| `npm run typecheck` | Checa os tipos |
| `npm run lint` | Lint |

## Decisões técnicas

- **Dados com React Query:** cache por tela, recarrega ao voltar para o app e atualiza a tela na hora
  (otimista) em água, esforço e metas.
- **Sessão no Keychain/Keystore** (`expo-secure-store`), dividida em pedaços por causa do limite de tamanho.
- **API com o token do aluno:** `src/lib/api.ts` envia `Authorization: Bearer`; a API roda tudo sob RLS.
  Na web o caminho é relativo (`/api/...`); no Android, `EXPO_PUBLIC_SITE_URL` + `/api/...`.
- **Datas locais:** "hoje" é calculado no fuso do aparelho (`toLocalISODate`), não em UTC.
- **Fora dos workspaces da raiz:** o React Native fixa versões próprias de React. O core entra por
  link `file:` e o `metro.config.js` observa a pasta dele.
