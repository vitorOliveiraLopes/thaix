import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { memo, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Txt, tapFeedback, type IconName } from '@/components/ui';
import { useUserId } from '@/lib/account';
import { apiPost } from '@/lib/api';
import { useChatHistory, type ChatMessage, type PendingAction } from '@/lib/chat';
import { qk } from '@/lib/query';
import { radius, spacing, useTheme } from '@/theme';

const QUICK: { icon: IconName; label: string; prompt: string }[] = [
  { icon: 'water-outline', label: 'Registrar hidratação', prompt: 'Quero registrar minha hidratação de hoje' },
  { icon: 'scale-outline', label: 'Atualizar peso', prompt: 'Quero atualizar meu peso' },
  { icon: 'trophy-outline', label: 'Registrar recorde', prompt: 'Quero registrar um recorde pessoal' },
  { icon: 'help-circle-outline', label: 'Tirar uma dúvida', prompt: 'Tenho uma dúvida sobre meu treino' },
];

type Row = { kind: 'msg'; msg: ChatMessage } | { kind: 'action'; action: PendingAction } | { kind: 'typing' };

type ChatResponse = { message?: string; pendingActions?: { id: string; toolName: string; summary: string }[] };

export default function ChatScreen() {
  const c = useTheme();
  const userId = useUserId();
  const client = useQueryClient();
  const history = useChatHistory(userId);

  const [local, setLocal] = useState<ChatMessage[]>([]);
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const counter = useRef(0);

  const nextId = (prefix: string) => `${prefix}-${++counter.current}`;
  const messages = useMemo(() => [...(history.data ?? []), ...local], [history.data, local]);

  // Lista invertida: o item 0 fica embaixo, perto do campo de texto.
  const rows: Row[] = useMemo(() => {
    const list: Row[] = [
      ...messages.map((msg) => ({ kind: 'msg' as const, msg })),
      ...actions.filter((a) => a.status === 'pending').map((action) => ({ kind: 'action' as const, action })),
    ];
    if (sending) list.push({ kind: 'typing' });
    return list.reverse();
  }, [messages, actions, sending]);

  function pushAssistant(content: string) {
    setLocal((prev) => [...prev, { id: nextId('a'), role: 'assistant', content }]);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    tapFeedback();
    setLocal((prev) => [...prev, { id: nextId('u'), role: 'user', content: trimmed }]);
    setInput('');
    setSending(true);
    try {
      const res = await apiPost<ChatResponse>('/api/chat', { message: trimmed }, 60_000);
      if (res.message) pushAssistant(res.message);
      if (res.pendingActions?.length) {
        setActions((prev) => [...prev, ...res.pendingActions!.map((a) => ({ ...a, status: 'pending' as const }))]);
      }
    } catch (e) {
      pushAssistant(e instanceof Error && e.message ? `Não consegui responder agora: ${e.message}` : 'Não consegui responder agora. Tenta de novo?');
    } finally {
      setSending(false);
    }
  }

  async function resolve(id: string, confirmed: boolean) {
    try {
      const res = await apiPost<{ message?: string }>('/api/chat/confirm', { actionId: id, confirmed });
      setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status: confirmed ? 'confirmed' : 'declined' } : a)));
      if (res.message) pushAssistant(res.message);
      if (confirmed) {
        // O registro feito pelo chat aparece na home e no desempenho.
        client.invalidateQueries({ queryKey: qk.home(userId) });
        client.invalidateQueries({ queryKey: qk.progress(userId) });
        client.invalidateQueries({ queryKey: qk.prs(userId) });
        client.invalidateQueries({ queryKey: qk.account(userId) });
      }
    } catch {
      pushAssistant('Não consegui processar essa ação. Tenta de novo?');
    }
  }

  const empty = !history.isPending && messages.length === 0;

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Txt variant="title">Coach</Txt>
        <Txt variant="small" color="muted">
          Tire dúvidas ou registre dados do seu treino
        </Txt>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
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
            keyExtractor={(r) => (r.kind === 'msg' ? r.msg.id : r.kind === 'action' ? `act-${r.action.id}` : 'typing')}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) =>
              item.kind === 'msg' ? (
                <Bubble msg={item.msg} />
              ) : item.kind === 'action' ? (
                <ActionCard action={item.action} onResolve={resolve} />
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

const Bubble = memo(function Bubble({ msg }: { msg: ChatMessage }) {
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

function ActionCard({ action, onResolve }: { action: PendingAction; onResolve: (id: string, ok: boolean) => Promise<void> }) {
  const c = useTheme();
  const [busy, setBusy] = useState(false);
  async function handle(ok: boolean) {
    setBusy(true);
    await onResolve(action.id, ok);
    setBusy(false);
  }
  return (
    <View style={[styles.action, styles.left, { backgroundColor: c.primarySoft, borderColor: c.primary }]}>
      <Txt variant="label">{action.summary}</Txt>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button label="Confirmar" size="sm" icon="checkmark" onPress={() => handle(true)} loading={busy} style={{ flex: 1 }} />
        <Button label="Cancelar" size="sm" variant="outline" onPress={() => handle(false)} disabled={busy} />
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
  action: { maxWidth: '90%', borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, gap: spacing.md },
  quick: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  quickIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderRadius: 22, paddingHorizontal: spacing.lg, paddingTop: 11, paddingBottom: 11, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
