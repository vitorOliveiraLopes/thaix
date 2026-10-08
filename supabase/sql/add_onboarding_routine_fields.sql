-- ============================================================
-- ThaixSkill — Rotina do aluno no onboarding do app
--
-- Duas perguntas novas, obrigatórias no onboarding do app:
--   session_minutes: minutos disponíveis por sessão (20, 30, 45 ou 60)
--   equipment:       equipamentos disponíveis (múltipla escolha)
--
-- Insumos do planner e do agente coach (Fase 2). Rodar uma vez no
-- SQL Editor do Supabase. Idempotente: pode rodar de novo sem erro.
-- ============================================================

ALTER TABLE public.onboarding_responses
  ADD COLUMN IF NOT EXISTS session_minutes smallint,
  ADD COLUMN IF NOT EXISTS equipment       text[] NOT NULL DEFAULT '{}';

-- Valores válidos (os mesmos de packages/core/src/catalog.ts)
ALTER TABLE public.onboarding_responses
  DROP CONSTRAINT IF EXISTS onboarding_responses_session_minutes_check;
ALTER TABLE public.onboarding_responses
  ADD CONSTRAINT onboarding_responses_session_minutes_check
  CHECK (session_minutes IS NULL OR session_minutes IN (20, 30, 45, 60));

ALTER TABLE public.onboarding_responses
  DROP CONSTRAINT IF EXISTS onboarding_responses_equipment_check;
ALTER TABLE public.onboarding_responses
  ADD CONSTRAINT onboarding_responses_equipment_check
  CHECK (equipment <@ ARRAY['barra', 'paralelas', 'argolas', 'caixa', 'chao']::text[]);

-- Conferência: deve listar as duas colunas novas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'onboarding_responses'
  AND column_name IN ('session_minutes', 'equipment');
