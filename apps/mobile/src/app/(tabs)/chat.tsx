import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { memo, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Txt, tapFeedback, type IconName } from '@/components/ui';
import { useUserId } from '@/lib/account';
import { apiPost } from '@/lib/api';
import { useChatHistory, type ChatAction, type ChatEntry, type ChatMessage } from '@/lib/chat';
import { toLocalISODate, type ActionState } from '@thaix/core';
import { qk } from '@/lib/query';
import { radius, spacing, useTheme } from '@/theme';

const QUICK: { icon: IconName; label: string; prompt: string }[] = [
  { icon: 'time-outline', label: 'Hoje tenho pouco tempo', prompt: 'Hoje só tenho 20 minutos para treinar. Consegue ajustar meu treino?' },
  { icon: 'barbell-outline', label: 'Contar o WOD da box', prompt: 'Quero contar o que fiz hoje na box' },
  { icon: 'trending-up-outline', label: 'Quanto falta para subir de nível?', prompt: 'Quanto falta para eu subir de nível nas minhas skills?' },
  { icon: 'swap-horizontal-outline', label: 'Trocar um exercício', prompt: 'Quero trocar um exercício do treino de hoje' },
  { icon: 'flag-outline', label: 'Definir um objetivo', prompt: 'Quero definir um objetivo para as minhas skills' },
];

/** Cache que cada tipo de confirmação deixa desatualizado. */
function keysToRefresh(userId: string, refresh: string[]) {
  const keys: (readonly unknown[])[] = [];
  for (const r of refresh) {
    if (r === 'today' || r === 'skills') keys.push(['today-workouts', userId], ['workout']);
    if (r === 'workout') keys.push(['workout']);
    if (r === 'routine') keys.push(qk.onboarding(userId), ['today-workouts', userId]);
    if (r === 'skills') keys.push(qk.skillProgress(userId));
    if (r === 'home') keys.push(qk.home(userId));
    if (r === 'progress') keys.push(qk.progress(userId));
    if (r === 'prs') keys.push(qk.prs(userId));
    if (r === 'account') keys.push(qk.account(userId));
  }
  return keys;
}

type LocalMessage = Omit<ChatMessage, 'created_at'>;
type Row = ChatEntry | { kind: 'local'; msg: LocalMessage } | { kind: 'typing' };

type ChatResponse = { message?: string };

export default function ChatScreen() {
  const c = useTheme();
  const userId = useUserId();
  const client = useQueryClient();
  const history = useChatHistory(userId);

  // Mensagens só locais: a do aluno enquanto o coach responde e avisos de erro.
  const [local, setLocal] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const counter = useRef(0);

  const nextId = (prefix: string) => `${prefix}-${++counter.current}`;
  // Lista invertida: o item 0 fica embaixo, perto do campo de texto.
  // Propostas ficam no ponto da conversa em que surgiram, com a decisão.
  const rows: Row[] = useMemo(() => {
    const list: Row[] = [...(history.data?.entries ?? []), ...local.map((msg) => ({ kind: 'local' as const, msg }))];
    if (sending) list.push({ kind: 'typing' });
    return list.reverse();
  }, [history.data, local, sending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    tapFeedback();
    setLocal([{ id: nextId('u'), role: 'user', content: trimmed }]);
    setInput('');
    setSending(true);
    let errorNote: string | null = null;
    try {
      // A data do aparelho: o servidor roda em UTC e "hoje" precisa ser o do aluno.
      await apiPost<ChatResponse>('/api/chat', { message: trimmed, today: toLocalISODate(), dow: new Date().getDay() }, 70_000);
    } catch (e) {
      errorNote = e instanceof Error && e.message ? e.message : 'Não consegui responder agora. Tenta de novo?';
    }
    // O servidor é a fonte da verdade (resposta, propostas e a própria mensagem).
    await history.refetch();
    setLocal(errorNote ? [{ id: nextId('e'), role: 'assistant', content: errorNote }] : []);
    setSending(false);
  }

  /** Devolve uma mensagem de erro para o card, ou null se deu certo. */
  async function resolve(id: string, confirmed: boolean): Promise<string | null> {
    let error: string | null = null;
    try {
      const res = await apiPost<{ refresh?: string[] }>('/api/chat/confirm', { actionId: id, confirmed });
      // O que a ação mudou aparece na hora nas outras telas.
      for (const key of keysToRefresh(userId, res.refresh ?? [])) client.invalidateQueries({ queryKey: key });
    } catch (e) {
      error = e instanceof Error && e.message ? e.message : 'Não consegui processar agora. Tenta de novo?';
    }
    // O card passa a mostrar a decisão gravada no servidor.
    await history.refetch();
    return error;
  }

  const empty = !history.isPending && (history.data?.entries.length ?? 0) === 0 && local.length === 0;

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Txt variant="title">Coach</Txt>
        <Txt variant="small" color="muted">
          Tire dúvidas ou registre dados do seu treino
        </Txt>
      </View>

      {/* Mede a própria posição na tela (abaixo do cabeçalho, acima das abas):
          o campo de texto sobe exatamente até ficar acima do teclado, no iOS e no Android. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding" automaticOffset>
        {history.isPending ? (
          <View style={[styles.flex, styles.center]}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : empty ? (
          <View style={[styles.flex, { padding: spacing.lg, gap: spacing.sm, justifyContent: 'flex-end' }]}>
            <Txt variant="small" color="muted" center>
              Como posso ajudar hoje?
            </Txt>
            {QUICK.map((q) => (
              <Card key={q.label} onPress={() => send(q.prompt)} style={styles.quick}>
                <View style={[styles.quickIcon, { backgroundColor: c.primarySoft }]}>
                  <Ionicons name={q.icon} size={18} color={c.primary} />
                </View>
                <Txt variant="subheading">{q.label}</Txt>
              </Card>
            ))}
          </View>
        ) : (
          <FlatList
            inverted
            data={rows}
            keyExtractor={(r) => (r.kind === 'msg' || r.kind === 'local' ? r.msg.id : r.kind === 'action' ? `act-${r.action.id}` : 'typing')}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) =>
              item.kind === 'msg' || item.kind === 'local' ? (
                <Bubble msg={item.msg} />
              ) : item.kind === 'action' ? (
                <ActionCard action={item.action} state={item.state} onResolve={resolve} />
              ) : (
                <View style={[styles.bubble, styles.left, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <ActivityIndicator size="small" color={c.muted} />
                </View>
              )
            }
          />
        )}

        <View style={[styles.inputBar, { borderTopColor: c.border, backgroundColor: c.background }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Digite sua mensagem..."
            placeholderTextColor={c.muted}
            multiline
            maxLength={1000}
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            disabled={!input.trim() || sending}
            onPress={() => send(input)}
            style={[styles.send, { backgroundColor: c.primary, opacity: !input.trim() || sending ? 0.4 : 1 }]}
          >
            <Ionicons name="arrow-up" size={20} color={c.onPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const Bubble = memo(function Bubble({ msg }: { msg: LocalMessage }) {
  const c = useTheme();
  const mine = msg.role === 'user';
  return (
    <View
      style={[
        styles.bubble,
        mine
          ? [styles.right, { backgroundColor: c.primary, borderColor: c.primary }]
          : [styles.left, { backgroundColor: c.surface, borderColor: c.border }],
      ]}
    >
      <Txt style={{ color: mine ? c.onPrimary : c.text }}>{msg.content}</Txt>
    </View>
  );
});

type Resolved = Exclude<ActionState, 'pending'>;

const STATE_UI: Record<Resolved, { icon: IconName; label: string; tone: 'success' | 'muted' | 'danger' | 'warning' }> = {
  confirmed: { icon: 'checkmark-circle', label: 'Você confirmou', tone: 'success' },
  declined: { icon: 'close-circle', label: 'Você cancelou', tone: 'muted' },
  failed: { icon: 'alert-circle', label: 'Não foi aplicado', tone: 'danger' },
  expired: { icon: 'time', label: 'Expirou sem resposta', tone: 'warning' },
};

/** Nota padrão quando o servidor não guardou uma. */
const DEFAULT_NOTE: Record<Resolved, string> = {
  confirmed: 'Feito!',
  declined: 'Nada foi alterado.',
  failed: 'Peça de novo ao coach.',
  expired: 'Nada foi alterado. Se ainda quiser, é só pedir de novo.',
};

function ActionCard({
  action,
  state,
  onResolve,
}: {
  action: ChatAction;
  state: ActionState;
  onResolve: (id: string, ok: boolean) => Promise<string | null>;
}) {
  const c = useTheme();
  const [busy, setBusy] = useState<'confirm' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(ok: boolean) {
    tapFeedback();
    setBusy(ok ? 'confirm' : 'cancel');
    setError(null);
    setError(await onResolve(action.id, ok));
    setBusy(null);
  }

  if (state !== 'pending') {
    const ui = STATE_UI[state];
    const tone = { success: [c.success, c.successSoft], muted: [c.muted, c.surface], danger: [c.danger, c.dangerSoft], warning: [c.warning, c.warningSoft] }[ui.tone];
    const note = action.result_note ?? DEFAULT_NOTE[state];
    return (
      <View
        accessible
        accessibilityLabel={`${action.summary}. ${ui.label}. ${note}`}
        style={[styles.action, styles.left, { backgroundColor: c.surface, borderColor: c.border }]}
      >
        <Txt variant="subheading" color={state === 'confirmed' ? undefined : 'muted'}>
          {action.summary}
        </Txt>
        <View style={[styles.status, { backgroundColor: tone[1] }]}>
          <Ionicons name={ui.icon} size={18} color={tone[0]} />
          <View style={styles.flex}>
            <Txt variant="small" style={{ color: tone[0], fontWeight: '600' }}>
              {ui.label}
            </Txt>
            <Txt variant="small" color="muted">
              {note}
            </Txt>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.action, styles.left, { backgroundColor: c.primarySoft, borderColor: c.primary }]}>
      <Txt variant="subheading">{action.summary}</Txt>
      {action.preview.length > 0 && (
        <View style={{ gap: 4 }}>
          {action.preview.map((line, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Txt variant="small" color="primary">
                •
              </Txt>
              <Txt variant="small" style={styles.flex}>
                {line}
              </Txt>
            </View>
          ))}
        </View>
      )}
      {error && (
        <Txt variant="small" style={{ color: c.danger }}>
          {error}
        </Txt>
      )}
      <View style={styles.actionButtons}>
        <Button
          label="Confirmar"
          size="sm"
          icon="checkmark"
          onPress={() => handle(true)}
          loading={busy === 'confirm'}
          disabled={busy !== null}
          style={styles.flex}
        />
        <Button
          label="Cancelar"
          size="sm"
          variant="outline"
          onPress={() => handle(false)}
          loading={busy === 'cancel'}
          disabled={busy !== null}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, gap: 2 },
  list: { padding: spacing.lg, gap: spacing.sm },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  left: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  right: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  // Largura fixa: encolhido ao tamanho do resumo, o botão Confirmar quebrava.
  action: { width: '90%', borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, gap: spacing.md },
  actionButtons: { flexDirection: 'row', gap: spacing.sm },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.md, padding: spacing.sm },
  quick: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  quickIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderRadius: 22, paddingHorizontal: spacing.lg, paddingTop: 11, paddingBottom: 11, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
