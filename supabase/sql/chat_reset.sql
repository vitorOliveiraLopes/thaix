-- ============================================================
-- ThaixSkill — "Nova conversa" no chat do coach
-- O aluno pode apagar a própria conversa (mensagens e propostas).
-- O que ele já confirmou (treino ajustado, registros) continua salvo.
-- Pode rodar mais de uma vez.
-- ============================================================

DROP POLICY IF EXISTS "usuario_apaga_proprias_mensagens" ON chat_messages;
CREATE POLICY "usuario_apaga_proprias_mensagens"
  ON chat_messages FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "usuario_apaga_proprias_acoes" ON chat_pending_actions;
CREATE POLICY "usuario_apaga_proprias_acoes"
  ON chat_pending_actions FOR DELETE
  USING (user_id = auth.uid());

GRANT DELETE ON chat_messages        TO authenticated;
GRANT DELETE ON chat_pending_actions TO authenticated;
