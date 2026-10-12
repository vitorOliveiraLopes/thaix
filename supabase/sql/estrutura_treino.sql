-- ============================================================
-- ThaixSkill — Estrutura de treino da Coach Thaís
--   Força: 4–5 exercícios (2 de abdômen + membros superiores da skill)
--   No final: 2 educativos do nível do aluno, em progressão
--
-- skill_exercises ganha:
--   muscle_group: grupo muscular dos exercícios de força, para o treino
--                 alternar (ex.: HSPU = ombro, tríceps, peitoral; puxadas = dorsal)
--   video_url:    vídeo curto do exercício/educativo com a explicação da Thaís
--
-- Convenções da tabela usadas pelo gerador:
--   category = 'core'  → abdômen
--   category = 'forca' → membros superiores específicos da skill
--   category = 'skill' → educativos (a ordem da progressão é o order_index)
-- Pode rodar mais de uma vez.
-- ============================================================

ALTER TABLE public.skill_exercises ADD COLUMN IF NOT EXISTS muscle_group text;
ALTER TABLE public.skill_exercises ADD COLUMN IF NOT EXISTS video_url text;

ALTER TABLE public.skill_exercises DROP CONSTRAINT IF EXISTS skill_exercises_muscle_group_check;
ALTER TABLE public.skill_exercises ADD CONSTRAINT skill_exercises_muscle_group_check
  CHECK (muscle_group IS NULL OR muscle_group IN
    ('dorsal', 'ombro', 'triceps', 'peitoral', 'biceps', 'antebraco', 'abdomen', 'lombar', 'quadril'));

-- ── Conferência: quantos exercícios há por skill, nível e tipo ──────────────
-- Para o treino sair completo, cada skill precisa, em cada nível, de pelo
-- menos 2 de core, 3 de força e 2 educativos (o ideal é ter mais, para variar).
SELECT skill_id, level,
       count(*) FILTER (WHERE category = 'core')  AS abdomen,
       count(*) FILTER (WHERE category = 'forca') AS forca,
       count(*) FILTER (WHERE category = 'skill') AS educativos,
       count(*) FILTER (WHERE category = 'forca' AND muscle_group IS NULL) AS forca_sem_grupo,
       count(*) FILTER (WHERE category = 'skill' AND video_url IS NULL)    AS educativos_sem_video
FROM public.skill_exercises
GROUP BY skill_id, level
ORDER BY skill_id, array_position(ARRAY['iniciante','intermediario','avancado'], level);
