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
import { toLocalISODate } from '@thaix/core';
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

type Row = { kind: 'msg'; msg: ChatMessage } | { kind: 'action'; action: PendingAction } | { kind: 'typing' };

type ChatResponse = { message?: string };

export default function ChatScreen() {
  const c = useTheme();
  const userId = useUserId();
  const client = useQueryClient();
  const history = useChatHistory(userId);

  // Mensagens só locais: a do aluno enquanto o coach responde e avisos de erro.
  const [local, setLocal] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const counter = useRef(0);

  const nextId = (prefix: string) => `${prefix}-${++counter.current}`;
  const messages = useMemo(() => [...(history.data?.messages ?? []), ...local], [history.data, local]);

  // Lista invertida: o item 0 fica embaixo, perto do campo de texto.
  const rows: Row[] = useMemo(() => {
    const list: Row[] = [
      ...messages.map((msg) => ({ kind: 'msg' as const, msg })),
      ...(history.data?.pending ?? []).map((action) => ({ kind: 'action' as const, action })),
    ];
    if (sending) list.push({ kind: 'typing' });
    return list.reverse();
  }, [messages, history.data, sending]);

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

  async function resolve(id: string, confirmed: boolean) {
    try {
      const res = await apiPost<{ success?: boolean; message?: string; refresh?: string[] }>('/api/chat/confirm', { actionId: id, confirmed });
      // O que a ação mudou aparece na hora nas outras telas.
      for (const key of keysToRefresh(userId, res.refresh ?? [])) client.invalidateQueries({ queryKey: key });
    } catch (e) {
      setLocal((prev) => [...prev, { id: nextId('e'), role: 'assistant', content: e instanceof Error && e.message ? e.message : 'Não consegui processar essa ação.' }]);
    }
    await history.refetch();
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
      <Txt variant="subheading">{action.summary}</Txt>
      {action.preview.length > 0 && (
        <View style={{ gap: 4 }}>
          {action.preview.map((line, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Txt variant="small" color="primary">
                •
              </Txt>
              <Txt variant="small" style={{ flex: 1 }}>
                {line}
              </Txt>
            </View>
          ))}
        </View>
      )}
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
