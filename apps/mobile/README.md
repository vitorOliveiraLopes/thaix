# ThaixSkill — app (Expo)

App iOS e Android do ThaixSkill, feito com Expo SDK 57 e Expo Router.
As regras de treino vêm do pacote `@thaix/core` (`packages/core`), o mesmo que a API usa.

## Antes do primeiro teste

1. **Rode o SQL novo no Supabase** (SQL Editor): `supabase/sql/add_onboarding_routine_fields.sql`.
   Ele cria `session_minutes` e `equipment` em `onboarding_responses`. Sem ele o onboarding não salva.
2. **Crie o `.env.local`** a partir da raiz do repositório:

   ```cmd
   cd apps\mobile
   copy .env.example .env.local
   ```

   Preencha a **anon key** do Supabase. `EXPO_PUBLIC_API_URL` aponta para a API na Vercel
   (conclusão de treino e chat). Nunca coloque a service role aqui: tudo com `EXPO_PUBLIC_` vai dentro do app.

## Rodar no celular (Windows, CMD)

```cmd
npm install
npx expo start
```

Leia o QR code com a câmera (iPhone) ou com o Expo Go (Android). Se não conectar, use `npx expo start --tunnel`.
O app é só iOS e Android: não aperte `w` nem abra o `localhost:8081` no navegador.

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
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://thaix.vercel.app --visibility plaintext
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
├─ components/               UI reutilizável (ui, inputs, sets, workouts, charts...)
├─ lib/                      Dados: Supabase, API, React Query e hooks por assunto
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
- **Datas locais:** "hoje" é calculado no fuso do aparelho (`toLocalISODate`), não em UTC.
- **Fora dos workspaces da raiz:** a raiz ainda é o Next com outra versão do React. O core entra por
  link `file:` e o `metro.config.js` observa a pasta dele.
