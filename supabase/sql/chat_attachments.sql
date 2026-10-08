-- ============================================================
-- ThaixSkill — Cards nativos nas mensagens do coach
-- Ex.: a lista de exercícios do treino de hoje vira um card no chat.
-- Pode rodar mais de uma vez. O app e a API funcionam sem a coluna
-- (o card só não é salvo), então a ordem do deploy não importa.
-- ============================================================

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachments jsonb;
