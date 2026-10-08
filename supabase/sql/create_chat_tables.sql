-- ============================================================
-- ThaixSkill — Chat conversacional
-- Tabelas de histórico de conversa e de ações pendentes de
-- confirmação (fluxo propor → confirmar, nunca grava direto).
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
  ON chat_messages (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_pending_actions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name    text NOT NULL,
  params       jsonb NOT NULL,
  summary      text NOT NULL,        -- texto amigável mostrado no card de confirmação
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined', 'failed')),
  result_note  text,                  -- mensagem de erro ou confirmação após execução
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_chat_pending_user_status
  ON chat_pending_actions (user_id, status);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE chat_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_ve_proprias_mensagens"
  ON chat_messages FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "usuario_insere_proprias_mensagens"
  ON chat_messages FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "usuario_ve_proprias_acoes_pendentes"
  ON chat_pending_actions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "usuario_insere_proprias_acoes_pendentes"
  ON chat_pending_actions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "usuario_atualiza_proprias_acoes_pendentes"
  ON chat_pending_actions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT             ON chat_messages        TO authenticated;
GRANT SELECT, INSERT, UPDATE     ON chat_pending_actions  TO authenticated;
