# ThaixSkill

App de treino de skills de calistenia e CrossFit da Coach Thaís.

## Estrutura

```
thaix/
├─ apps/mobile/      App iOS e Android (Expo). Ver apps/mobile/README.md
├─ packages/core/    @thaix/core: regras de negócio e gerador de treino, sem I/O, com testes
├─ src/              Next.js (web atual). Vira apps/api (só API) na próxima fase
├─ supabase/sql/     Scripts SQL aplicados no Supabase
└─ docs/             Decisões e pendências (ex.: pendencias-thais.md)
```

A arquitetura completa (app, API, core e agente coach) está no documento de arquitetura v2.

## Comandos (raiz)

| Comando | O que faz |
|---|---|
| `npm install` | Instala a web e liga o `@thaix/core` (workspace) |
| `npm test` | Roda os testes do core |
| `npm run typecheck` | Checa os tipos da web e do core |
| `npm run dev` | Sobe a web em http://localhost:3000 |
| `npm run build` | Testes + build do Next (é o que a Vercel roda) |

Para o app, veja `apps/mobile/README.md`.

## Regras

- Lógica de treino (níveis, progressão, seleção de exercícios) só em `packages/core`, com teste.
- Chaves secretas (service role, Anthropic) nunca com prefixo `NEXT_PUBLIC_` ou `EXPO_PUBLIC_`.
- `.env*` não vai para o git.
