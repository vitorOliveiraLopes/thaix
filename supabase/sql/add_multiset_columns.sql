-- ============================================================
-- ThaixSkill — Suporte a múltiplas séries por exercício
--
-- Adiciona colunas para armazenar o resultado de CADA série,
-- não apenas um valor único. reps_achieved / time_achieved_sec
-- continuam existindo e passam a representar a MELHOR série
-- (usado por PRs e por telas que só precisam de um resumo).
-- ============================================================

ALTER TABLE daily_workout_results
  ADD COLUMN IF NOT EXISTS reps_per_set jsonb,
  ADD COLUMN IF NOT EXISTS time_per_set jsonb;

COMMENT ON COLUMN daily_workout_results.reps_per_set IS
  'Array com o resultado de cada série, ex: [8, 6, 4]. Null/vazio para exercícios de tempo.';
COMMENT ON COLUMN daily_workout_results.time_per_set IS
  'Array com o tempo (segundos) de cada série, ex: [15, 12, 10]. Null/vazio para exercícios de reps.';
