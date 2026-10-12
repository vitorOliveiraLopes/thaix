# ThaixSkill

App de treino de skills de calistenia e CrossFit da Coach Thaís.

## Estrutura

```
thaix/
├─ apps/mobile/      Um projeto Expo: app Android, site e API (rotas em src/app/api). Ver apps/mobile/README.md
├─ packages/core/    @thaix/core: regras de negócio e gerador de treino, sem I/O, com testes
├─ supabase/sql/     Scripts SQL aplicados no Supabase (testes em supabase/tests)
└─ docs/             Decisões e pendências (ex.: pendencias-thais.md)
```

`packages/core` é workspace npm da raiz. `apps/mobile` fica fora (o React Native fixa versões
próprias) e usa o core por `file:../../packages/core`.

Na Vercel há **um projeto só** (Root Directory `apps/mobile`): o site e a API ficam no mesmo
domínio, sem CORS. O app Android chama a API nesse mesmo endereço.

## Comandos (raiz)

| Comando | O que faz |
|---|---|
| `npm install` | Instala o core (workspace) e as ferramentas de teste |
| `npm test` | Testes do core e do código de servidor do app (`apps/mobile/src/server`) |
| `npm run typecheck` | Tipos do core e do app |

Para rodar o app, o site e a API, veja `apps/mobile/README.md`.

## Regras

- Lógica de treino (níveis, progressão, seleção de exercícios) só em `packages/core`, com teste.
- Código de servidor só em `apps/mobile/src/server` e `src/app/api` (nunca importado por telas).
- Chaves secretas (service role, Anthropic) nunca com prefixo `EXPO_PUBLIC_`: tudo com esse
  prefixo vai dentro do app e do site.
- `.env*` não vai para o git.
