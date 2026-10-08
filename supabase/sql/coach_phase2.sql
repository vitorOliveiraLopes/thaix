-- ============================================================
-- ThaixSkill — Fase 2: coach com ferramentas
--
-- Rodar uma vez no SQL Editor do Supabase, DEPOIS de
-- add_onboarding_routine_fields.sql. Idempotente: pode rodar de novo.
--
--   1. Skill prioritária do aluno (foco)
--   2. Equipamento necessário por exercício
--   3. Treinos da box, objetivos e limitações do aluno
--   4. Base de conhecimento da Coach Thaís
--   5. Permissão para o coach ajustar o treino de HOJE (não concluído)
-- ============================================================


-- ── 1. Foco ──────────────────────────────────────────────────────────────────

ALTER TABLE public.onboarding_responses
  ADD COLUMN IF NOT EXISTS focus_skill_id text;

ALTER TABLE public.onboarding_responses
  DROP CONSTRAINT IF EXISTS onboarding_responses_focus_skill_check;
ALTER TABLE public.onboarding_responses
  ADD CONSTRAINT onboarding_responses_focus_skill_check
  CHECK (focus_skill_id IS NULL OR focus_skill_id IN ('pull-up', 'c2b', 'bmu', 't2b', 'hspu'));


-- ── 2. Equipamento por exercício ────────────────────────────────────────────
-- Lista vazia = não precisa de nada específico. Preencher com a Thaís
-- (ids: barra, paralelas, argolas, caixa, chao).

ALTER TABLE public.skill_exercises
  ADD COLUMN IF NOT EXISTS equipment text[] NOT NULL DEFAULT '{}';


-- ── 3a. Treinos da box ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.box_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        date NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('wod', 'forca', 'ginastica', 'cardio', 'outro')),
  intensity   smallint NOT NULL CHECK (intensity BETWEEN 1 AND 5),
  stimulus    text[] NOT NULL DEFAULT '{}'
              CHECK (stimulus <@ ARRAY['puxada', 'empurrada', 'core', 'pernas', 'cardio']::text[]),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_box_sessions_user_date ON public.box_sessions (user_id, date DESC);


-- ── 3b. Objetivos ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_goals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description  text NOT NULL,
  skill_id     text CHECK (skill_id IS NULL OR skill_id IN ('pull-up', 'c2b', 'bmu', 't2b', 'hspu')),
  target_date  date,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'dropped')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_student_goals_user ON public.student_goals (user_id, status);


-- ── 3c. Limitações físicas relatadas (não é diagnóstico) ────────────────────

CREATE TABLE IF NOT EXISTS public.student_limitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body_area    text NOT NULL,
  description  text NOT NULL,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_student_limitations_user ON public.student_limitations (user_id, active);


-- ── 4. Base de conhecimento (escrita só pelo painel/admin) ──────────────────

CREATE TABLE IF NOT EXISTS public.coach_knowledge (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_exercise_id  uuid REFERENCES public.skill_exercises(id) ON DELETE CASCADE,
  skill_id           text,
  topic              text NOT NULL,      -- ex.: 'execucao', 'erros_comuns', 'escala', 'progressao'
  content            text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_knowledge_exercise ON public.coach_knowledge (skill_exercise_id);


-- ── RLS das tabelas novas ───────────────────────────────────────────────────

ALTER TABLE public.box_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_goals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_limitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_knowledge     ENABLE ROW LEVEL SECURITY;

DO $func$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['box_sessions', 'student_goals', 'student_limitations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "proprio_select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "proprio_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "proprio_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "proprio_delete" ON public.%I', t);
    EXECUTE format('CREATE POLICY "proprio_select" ON public.%I FOR SELECT USING (user_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY "proprio_insert" ON public.%I FOR INSERT WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY "proprio_update" ON public.%I FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY "proprio_delete" ON public.%I FOR DELETE USING (user_id = auth.uid())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END
$func$;

DROP POLICY IF EXISTS "conhecimento_leitura" ON public.coach_knowledge;
CREATE POLICY "conhecimento_leitura" ON public.coach_knowledge FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.coach_knowledge TO authenticated;


-- ── 5. Ajustes do coach no treino de hoje ───────────────────────────────────
-- O aluno só altera/remove itens de treino próprio e ainda NÃO concluído.

DROP POLICY IF EXISTS "coach_ajusta_itens_update" ON public.daily_workout_items;
CREATE POLICY "coach_ajusta_itens_update" ON public.daily_workout_items
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.daily_workouts w
    WHERE w.id = daily_workout_id AND w.user_id = auth.uid() AND w.completed_at IS NULL
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.daily_workouts w
    WHERE w.id = daily_workout_id AND w.user_id = auth.uid() AND w.completed_at IS NULL
  ));

DROP POLICY IF EXISTS "coach_ajusta_itens_delete" ON public.daily_workout_items;
CREATE POLICY "coach_ajusta_itens_delete" ON public.daily_workout_items
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.daily_workouts w
    WHERE w.id = daily_workout_id AND w.user_id = auth.uid() AND w.completed_at IS NULL
  ));

GRANT UPDATE, DELETE ON public.daily_workout_items TO authenticated;

-- Adicionar skill pelo coach (insert do próprio progresso)
GRANT INSERT ON public.user_skill_progress TO authenticated;


-- ── Conferência ─────────────────────────────────────────────────────────────
SELECT table_name, COUNT(*) AS policies
FROM information_schema.tables t
LEFT JOIN pg_policies p ON p.tablename = t.table_name AND p.schemaname = 'public'
WHERE t.table_schema = 'public'
  AND t.table_name IN ('box_sessions', 'student_goals', 'student_limitations', 'coach_knowledge', 'daily_workout_items')
GROUP BY table_name
ORDER BY table_name;
