-- ============================================================
-- ThaixSkill — Otimização do banco (alertas do Supabase Advisor)
--
-- Nada muda em QUEM vê o QUÊ: só a forma como o banco executa as regras.
--
-- 1. Regras de acesso (RLS): auth.uid() passa a ser calculado uma vez por
--    consulta, e não uma vez por linha: `(select auth.uid())`.
-- 2. Regras de leitura repetidas em profiles e user_settings: a regra
--    "editar próprio" (FOR ALL) já cobre a leitura com a mesma condição.
-- 3. Índices nas chaves estrangeiras (junções e exclusões em cascata).
-- 4. Higiene: funções de gatilho não ficam chamáveis pela API, e a função
--    increment ganha search_path fixo.
--
-- Pode rodar mais de uma vez.
-- ============================================================

-- ── 1. auth.uid() avaliado uma vez por consulta ─────────────────────────────
DO $$
DECLARE
  p record;
  stmt text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
  LOOP
    stmt := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    -- Já otimizada: o Postgres guarda como "( SELECT auth.uid() AS uid)".
    IF p.qual IS NOT NULL AND p.qual NOT LIKE '%SELECT auth.uid()%' THEN
      stmt := stmt || ' USING (' || replace(p.qual, 'auth.uid()', '(select auth.uid())') || ')';
    END IF;
    IF p.with_check IS NOT NULL AND p.with_check NOT LIKE '%SELECT auth.uid()%' THEN
      stmt := stmt || ' WITH CHECK (' || replace(p.with_check, 'auth.uid()', '(select auth.uid())') || ')';
    END IF;
    IF stmt <> format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename) THEN
      EXECUTE stmt;
    END IF;
  END LOOP;
END $$;

-- ── 2. Leituras repetidas (a regra FOR ALL já cobre) ────────────────────────
DROP POLICY IF EXISTS "profiles: ver próprio" ON public.profiles;
DROP POLICY IF EXISTS "settings: ver próprio" ON public.user_settings;

-- ── 3. Índices nas chaves estrangeiras ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_daily_workout_items_workout   ON public.daily_workout_items (daily_workout_id);
CREATE INDEX IF NOT EXISTS idx_daily_workout_items_exercise  ON public.daily_workout_items (skill_exercise_id);
CREATE INDEX IF NOT EXISTS idx_daily_workout_results_exercise ON public.daily_workout_results (skill_exercise_id);
CREATE INDEX IF NOT EXISTS idx_daily_workouts_skill          ON public.daily_workouts (skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_exercises_skill         ON public.skill_exercises (skill_id);
CREATE INDEX IF NOT EXISTS idx_user_skill_progress_skill     ON public.user_skill_progress (skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_level_history_user      ON public.skill_level_history (user_id);
CREATE INDEX IF NOT EXISTS idx_skill_level_history_skill     ON public.skill_level_history (skill_id);
CREATE INDEX IF NOT EXISTS idx_achievements_exercise         ON public.achievements (skill_exercise_id);
CREATE INDEX IF NOT EXISTS idx_lessons_completed_lesson      ON public.course_lessons_completed (lesson_id);
CREATE INDEX IF NOT EXISTS idx_skill_videos_skill            ON public.skill_videos (skill_id);
CREATE INDEX IF NOT EXISTS idx_user_video_progress_video     ON public.user_video_progress (video_id);

-- ── 4. Higiene ──────────────────────────────────────────────────────────────
-- Funções de gatilho: rodam pelos gatilhos, nunca pela API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.increment(integer) SET search_path = '';
