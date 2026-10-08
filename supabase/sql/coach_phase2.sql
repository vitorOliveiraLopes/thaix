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
--   5. Função segura para o coach ajustar o treino de HOJE (não concluído)
--      e marcação de treino ajustado (não conta para subir de nível)
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
-- O aluno NÃO recebe UPDATE/DELETE direto em daily_workout_items (poderia
-- reduzir a meta e subir de nível sem esforço). Os ajustes passam por esta
-- função, que valida tudo, aplica numa transação e marca o treino como
-- ajustado. Treino ajustado não conta para subir de nível.

ALTER TABLE public.daily_workouts
  ADD COLUMN IF NOT EXISTS adjusted boolean NOT NULL DEFAULT false;

-- Remove o caminho direto, caso uma versão anterior deste script tenha rodado.
DROP POLICY IF EXISTS "coach_ajusta_itens_update" ON public.daily_workout_items;
DROP POLICY IF EXISTS "coach_ajusta_itens_delete" ON public.daily_workout_items;

CREATE OR REPLACE FUNCTION public.coach_apply_workout_ops(p_workout_id uuid, p_ops jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  w        record;
  op       jsonb;
  item     record;
  old_ex   record;
  new_ex   record;
  v_order  integer;
  v_sets   integer;
  remaining integer;
BEGIN
  SELECT id, user_id, date, completed_at INTO w
  FROM daily_workouts WHERE id = p_workout_id FOR UPDATE;

  IF w.id IS NULL OR w.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'treino não encontrado';
  END IF;
  IF w.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'treino já concluído';
  END IF;
  -- Só o treino de hoje (tolerância de 1 dia para fuso horário).
  IF abs(w.date - (now() AT TIME ZONE 'America/Sao_Paulo')::date) > 1 THEN
    RAISE EXCEPTION 'só o treino de hoje pode ser ajustado';
  END IF;
  IF jsonb_typeof(p_ops) <> 'array' OR jsonb_array_length(p_ops) = 0 OR jsonb_array_length(p_ops) > 20 THEN
    RAISE EXCEPTION 'operações inválidas';
  END IF;

  FOR op IN SELECT * FROM jsonb_array_elements(p_ops) LOOP
    v_order := (op->>'order_index')::integer;
    SELECT * INTO item FROM daily_workout_items
      WHERE daily_workout_id = p_workout_id AND order_index = v_order;
    IF item.daily_workout_id IS NULL THEN
      RAISE EXCEPTION 'exercício % não existe no treino', v_order;
    END IF;

    IF op->>'type' = 'remove' THEN
      DELETE FROM daily_workout_items WHERE daily_workout_id = p_workout_id AND order_index = v_order;

    ELSIF op->>'type' = 'set_sets' THEN
      v_sets := (op->>'sets')::integer;
      -- Só reduz: o coach alivia, nunca aumenta a meta.
      IF v_sets < 1 OR v_sets > item.sets THEN
        RAISE EXCEPTION 'número de séries inválido';
      END IF;
      UPDATE daily_workout_items SET sets = v_sets
        WHERE daily_workout_id = p_workout_id AND order_index = v_order;

    ELSIF op->>'type' = 'replace' THEN
      SELECT skill_id, category, level INTO old_ex FROM skill_exercises WHERE id = item.skill_exercise_id;
      SELECT id, skill_id, category, level, sets, reps, time_sec INTO new_ex
        FROM skill_exercises WHERE id = (op->>'skill_exercise_id')::uuid;
      -- Mesma skill e categoria; nível igual ou mais fácil.
      IF new_ex.id IS NULL OR new_ex.skill_id <> old_ex.skill_id OR new_ex.category <> old_ex.category
         OR array_position(ARRAY['iniciante','intermediario','avancado'], new_ex.level)
            > array_position(ARRAY['iniciante','intermediario','avancado'], old_ex.level) THEN
        RAISE EXCEPTION 'troca inválida';
      END IF;
      UPDATE daily_workout_items
        SET skill_exercise_id = new_ex.id, sets = new_ex.sets, reps = new_ex.reps, time_sec = new_ex.time_sec
        WHERE daily_workout_id = p_workout_id AND order_index = v_order;

    ELSE
      RAISE EXCEPTION 'operação desconhecida';
    END IF;
  END LOOP;

  SELECT count(*) INTO remaining FROM daily_workout_items WHERE daily_workout_id = p_workout_id;
  IF remaining = 0 THEN
    RAISE EXCEPTION 'o treino não pode ficar vazio';
  END IF;

  UPDATE daily_workouts SET adjusted = true WHERE id = p_workout_id;
  RETURN remaining;
END
$func$;

REVOKE ALL ON FUNCTION public.coach_apply_workout_ops(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coach_apply_workout_ops(uuid, jsonb) TO authenticated;

-- Adicionar skill pelo coach (insert do próprio progresso)
GRANT INSERT ON public.user_skill_progress TO authenticated;


-- ── Conferência ─────────────────────────────────────────────────────────────
SELECT table_name, COUNT(*) AS policies
FROM information_schema.tables t
LEFT JOIN pg_policies p ON p.tablename = t.table_name AND p.schemaname = 'public'
WHERE t.table_schema = 'public'
  AND t.table_name IN ('box_sessions', 'student_goals', 'student_limitations', 'coach_knowledge')
GROUP BY table_name
ORDER BY table_name;
