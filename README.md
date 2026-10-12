# ThaixSkill

App de treino de skills de calistenia e CrossFit da Coach Thaís.

## Estrutura

```
thaix/
├─ apps/mobile/      App Android e web (Expo, mesmo código). Ver apps/mobile/README.md
├─ apps/api/         API (Next.js na Vercel): coach, confirmação de ações, conclusão de treino
├─ packages/core/    @thaix/core: regras de negócio e gerador de treino, sem I/O, com testes
├─ supabase/sql/     Scripts SQL aplicados no Supabase (testes em supabase/tests)
└─ docs/             Decisões e pendências (ex.: pendencias-thais.md)
```

`apps/api` e `packages/core` são workspaces npm da raiz. `apps/mobile` fica fora (o React
Native fixa versões próprias) e usa o core por `file:../../packages/core`.

## Comandos (raiz)

| Comando | O que faz |
|---|---|
| `npm install` | Instala a API e o core (workspaces) |
| `npm test` | Testes do core e da API |
| `npm run typecheck` | Tipos do core e da API |
| `npm run dev:api` | Sobe a API em http://localhost:3000 |
| `npm run build:api` | Testes + build da API (é o que a Vercel roda) |

Para o app, veja `apps/mobile/README.md`.

### Variáveis da API (`apps/api/.env.local` e Vercel)

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase (chave pública) |
| `ANTHROPIC_API_KEY`, `COACH_MODEL`, `COACH_DAILY_LIMIT` | Coach |
| `WEB_APP_ORIGINS` | Domínios do app web liberados no CORS (separados por vírgula) |
| `WEB_APP_URL` | Para onde a raiz da API redireciona quem abre no navegador |
| `SENTRY_DSN` | Monitoramento de erros (opcional) |

## Regras

- Lógica de treino (níveis, progressão, seleção de exercícios) só em `packages/core`, com teste.
- Chaves secretas (service role, Anthropic) nunca com prefixo `NEXT_PUBLIC_` ou `EXPO_PUBLIC_`.
- `.env*` não vai para o git.
