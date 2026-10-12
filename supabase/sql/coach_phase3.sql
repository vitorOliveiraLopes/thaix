-- ============================================================
-- ThaixSkill — Coach fase 3: mais ações pelo chat
--   1. coach_apply_workout_ops v2: + adicionar exercício e mudar meta
--   2. coach_manage_skill: tirar skill (guardando o nível), trazer de volta
--      e voltar um nível
--   3. user_skill_paused: nível guardado das skills tiradas (o aluno só lê;
--      só a função grava, para ninguém "restaurar" um nível que não tinha)
-- Pode rodar mais de uma vez. Rode DEPOIS do coach_phase2.sql.
-- ============================================================

-- ── 3. Nível guardado das skills tiradas ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_skill_paused (
  user_id                    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id                   text NOT NULL,
  level                      text NOT NULL,
  week_number                integer NOT NULL,
  sessions_at_current_level  integer NOT NULL DEFAULT 0,
  paused_at                  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);
ALTER TABLE public.user_skill_paused ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aluno_le_skills_pausadas" ON public.user_skill_paused;
CREATE POLICY "aluno_le_skills_pausadas" ON public.user_skill_paused FOR SELECT USING (user_id = auth.uid());
GRANT SELECT ON public.user_skill_paused TO authenticated;


-- ── 1. Ajustes no treino de hoje (substitui a versão da fase 2) ─────────────
CREATE OR REPLACE FUNCTION public.coach_apply_workout_ops(p_workout_id uuid, p_ops jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  w          record;
  op         jsonb;
  item       record;
  old_ex     record;
  new_ex     record;
  v_order    integer;
  v_sets     integer;
  v_reps     integer;
  v_time     integer;
  v_level    text;
  remaining  integer;
  levels     text[] := ARRAY['iniciante','intermediario','avancado'];
BEGIN
  SELECT id, user_id, skill_id, date, completed_at INTO w
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

    -- Adicionar: exercício do catálogo da mesma skill, nível do aluno ou abaixo.
    IF op->>'type' = 'add' THEN
      SELECT id, skill_id, level, sets, reps, time_sec INTO new_ex
        FROM skill_exercises WHERE id = (op->>'skill_exercise_id')::uuid;
      SELECT level INTO v_level FROM user_skill_progress WHERE user_id = w.user_id AND skill_id = w.skill_id;
      IF new_ex.id IS NULL OR new_ex.skill_id <> w.skill_id OR v_level IS NULL
         OR array_position(levels, new_ex.level) > array_position(levels, v_level) THEN
        RAISE EXCEPTION 'exercício inválido para este treino';
      END IF;
      IF EXISTS (SELECT 1 FROM daily_workout_items WHERE daily_workout_id = p_workout_id AND skill_exercise_id = new_ex.id) THEN
        RAISE EXCEPTION 'o exercício já está no treino';
      END IF;
      IF (SELECT count(*) FROM daily_workout_items WHERE daily_workout_id = p_workout_id) >= 15 THEN
        RAISE EXCEPTION 'o treino já tem exercícios demais';
      END IF;
      v_sets := COALESCE((op->>'sets')::integer, new_ex.sets);
      v_reps := CASE WHEN new_ex.reps IS NULL THEN NULL ELSE COALESCE((op->>'reps')::integer, new_ex.reps) END;
      v_time := CASE WHEN new_ex.time_sec IS NULL THEN NULL ELSE COALESCE((op->>'time_sec')::integer, new_ex.time_sec) END;
      IF v_sets < 1 OR v_sets > 6
         OR (v_reps IS NOT NULL AND (v_reps < 1 OR v_reps > 30))
         OR (v_time IS NOT NULL AND (v_time < 5 OR v_time > 300)) THEN
        RAISE EXCEPTION 'meta inválida';
      END IF;
      INSERT INTO daily_workout_items (daily_workout_id, skill_exercise_id, order_index, sets, reps, time_sec)
      VALUES (
        p_workout_id, new_ex.id,
        (SELECT COALESCE(max(order_index), 0) + 1 FROM daily_workout_items WHERE daily_workout_id = p_workout_id),
        v_sets, v_reps, v_time
      );
      CONTINUE;
    END IF;

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
      -- Aliviar: só reduz.
      IF v_sets < 1 OR v_sets > item.sets THEN
        RAISE EXCEPTION 'número de séries inválido';
      END IF;
      UPDATE daily_workout_items SET sets = v_sets
        WHERE daily_workout_id = p_workout_id AND order_index = v_order;

    ELSIF op->>'type' = 'set_target' THEN
      -- Meta pedida pelo aluno: limites seguros e o mesmo tipo (reps ou tempo).
      v_sets := (op->>'sets')::integer;
      v_reps := (op->>'reps')::integer;
      v_time := (op->>'time_sec')::integer;
      IF v_sets IS NULL OR v_sets < 1 OR v_sets > 6
         OR (item.reps IS NULL) <> (v_reps IS NULL) OR (item.time_sec IS NULL) <> (v_time IS NULL)
         OR (v_reps IS NOT NULL AND (v_reps < 1 OR v_reps > 30))
         OR (v_time IS NOT NULL AND (v_time < 5 OR v_time > 300)) THEN
        RAISE EXCEPTION 'meta inválida';
      END IF;
      UPDATE daily_workout_items SET sets = v_sets, reps = v_reps, time_sec = v_time
        WHERE daily_workout_id = p_workout_id AND order_index = v_order;

    ELSIF op->>'type' = 'replace' THEN
      SELECT skill_id, category, level INTO old_ex FROM skill_exercises WHERE id = item.skill_exercise_id;
      SELECT id, skill_id, category, level, sets, reps, time_sec INTO new_ex
        FROM skill_exercises WHERE id = (op->>'skill_exercise_id')::uuid;
      -- Mesma skill e categoria; nível igual ou mais fácil.
      IF new_ex.id IS NULL OR new_ex.skill_id <> old_ex.skill_id OR new_ex.category <> old_ex.category
         OR array_position(levels, new_ex.level) > array_position(levels, old_ex.level) THEN
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

  -- Treino ajustado conta para a sequência, mas não para subir de nível.
  UPDATE daily_workouts SET adjusted = true WHERE id = p_workout_id;
  RETURN remaining;
END
$func$;

REVOKE ALL ON FUNCTION public.coach_apply_workout_ops(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coach_apply_workout_ops(uuid, jsonb) TO authenticated;


-- ── 2. Skills: tirar (guardando o nível) e voltar um nível ──────────────────
CREATE OR REPLACE FUNCTION public.coach_manage_skill(p_skill_id text, p_action text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  uid      uuid := auth.uid();
  prog     record;
  v_today  date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_prev   text;
  paused   record;
  levels   text[] := ARRAY['iniciante','intermediario','avancado'];
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  -- Trazer de volta: recria o progresso com o nível guardado.
  IF p_action = 'restore' THEN
    SELECT * INTO paused FROM user_skill_paused WHERE user_id = uid AND skill_id = p_skill_id FOR UPDATE;
    IF paused.skill_id IS NULL THEN
      RAISE EXCEPTION 'não há nível guardado para essa skill';
    END IF;
    IF EXISTS (SELECT 1 FROM user_skill_progress WHERE user_id = uid AND skill_id = p_skill_id) THEN
      RAISE EXCEPTION 'a skill já está nas suas trilhas';
    END IF;
    INSERT INTO user_skill_progress (user_id, skill_id, level, week_number, sessions_at_current_level, updated_at)
    VALUES (uid, p_skill_id, paused.level, paused.week_number, paused.sessions_at_current_level, now());
    DELETE FROM user_skill_paused WHERE user_id = uid AND skill_id = p_skill_id;
    RETURN paused.level;
  END IF;

  SELECT * INTO prog FROM user_skill_progress WHERE user_id = uid AND skill_id = p_skill_id FOR UPDATE;
  IF prog.skill_id IS NULL THEN
    RAISE EXCEPTION 'skill não está nas suas trilhas';
  END IF;

  IF p_action = 'remove' THEN
    IF (SELECT count(*) FROM user_skill_progress WHERE user_id = uid) <= 1 THEN
      RAISE EXCEPTION 'é preciso manter pelo menos uma skill';
    END IF;

    -- Guarda o nível para continuar de onde parou se a skill voltar.
    INSERT INTO user_skill_paused (user_id, skill_id, level, week_number, sessions_at_current_level, paused_at)
    VALUES (uid, p_skill_id, prog.level, prog.week_number, prog.sessions_at_current_level, now())
    ON CONFLICT (user_id, skill_id) DO UPDATE
      SET level = EXCLUDED.level, week_number = EXCLUDED.week_number,
          sessions_at_current_level = EXCLUDED.sessions_at_current_level, paused_at = now();

    UPDATE onboarding_responses
      SET focus_skill_id = NULL
      WHERE user_id = uid AND focus_skill_id = p_skill_id;

    DELETE FROM user_skill_progress WHERE user_id = uid AND skill_id = p_skill_id;

  ELSIF p_action = 'level_down' THEN
    v_prev := levels[array_position(levels, prog.level) - 1];
    IF v_prev IS NULL THEN
      RAISE EXCEPTION 'a skill já está no primeiro nível';
    END IF;

    UPDATE user_skill_progress
      SET level = v_prev, sessions_at_current_level = 0,
          level_updated_at = now(), updated_at = now()
      WHERE user_id = uid AND skill_id = p_skill_id;

    INSERT INTO skill_level_history (user_id, skill_id, from_level, to_level, week_number, changed_at)
    VALUES (uid, p_skill_id, prog.level, v_prev, prog.week_number, now());

  ELSE
    RAISE EXCEPTION 'ação desconhecida';
  END IF;

  -- Treino pendente de hoje dessa skill sai: ao tirar a skill ele não faz
  -- mais sentido; ao voltar o nível, a API cria outro no nível novo.
  DELETE FROM daily_workout_items
    WHERE daily_workout_id IN (
      SELECT id FROM daily_workouts
      WHERE user_id = uid AND skill_id = p_skill_id AND completed_at IS NULL AND date = v_today
    );
  DELETE FROM daily_workouts
    WHERE user_id = uid AND skill_id = p_skill_id AND completed_at IS NULL AND date = v_today;

  RETURN COALESCE(v_prev, 'ok');
END
$func$;

REVOKE ALL ON FUNCTION public.coach_manage_skill(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coach_manage_skill(text, text) TO authenticated;


-- ── Conferência ─────────────────────────────────────────────────────────────
SELECT proname FROM pg_proc WHERE proname IN ('coach_apply_workout_ops', 'coach_manage_skill') ORDER BY proname;
SELECT count(*) AS politicas_user_skill_paused FROM pg_policies WHERE tablename = 'user_skill_paused';
