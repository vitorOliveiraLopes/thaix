import { skillName } from '@thaix/core';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  BottomSheet,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  ErrorBox,
  ErrorView,
  Field,
  LoadingView,
  Screen,
  SectionLabel,
  Txt,
} from '@/components/ui';
import { useUserId } from '@/lib/account';
import { useAddPR, usePRs, type ExerciseOption, type PR } from '@/lib/progress';
import { font, radius, spacing, useTheme } from '@/theme';

const UNITS = [
  { value: 'reps', label: 'Reps' },
  { value: 'kg', label: 'kg' },
  { value: 'seconds', label: 'Segundos' },
];

function formatValue(value: number, unit: string) {
  if (unit === 'reps') return `${value} reps`;
  if (unit === 'kg') return `${value} kg`;
  if (unit === 'seconds') return `${value}s`;
  return `${value}`;
}

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function PRsScreen() {
  const userId = useUserId();
  const query = usePRs(userId);
  const [adding, setAdding] = useState(false);

  const { best, history } = useMemo(() => {
    const top = new Map<string, PR>();
    for (const pr of query.data?.prs ?? []) {
      const k = `${pr.exercise_id}|${pr.unit}`;
      const cur = top.get(k);
      if (!cur || pr.value > cur.value) top.set(k, pr);
    }
    const bestIds = new Set([...top.values()].map((p) => p.id));
    return {
      best: [...top.values()].sort((a, b) => a.exercise_name.localeCompare(b.exercise_name)),
      history: (query.data?.prs ?? []).filter((p) => !bestIds.has(p.id)),
    };
  }, [query.data]);

  if (query.isPending) return <LoadingView />;
  if (query.isError) return <ErrorView message="Não foi possível carregar seus recordes." onRetry={() => query.refetch()} />;

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <Button label="Novo" size="sm" variant="ghost" icon="add" onPress={() => setAdding(true)} /> }} />
      <Screen edges={[]} onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
        {best.length === 0 ? (
          <EmptyState
            emoji="🥇"
            title="Nenhum recorde ainda"
            message="Seus recordes aparecem sozinhos quando você conclui treinos. Você também pode registrar um manualmente."
            action={<Button label="Registrar recorde" variant="outline" size="sm" onPress={() => setAdding(true)} />}
          />
        ) : (
          <>
            <Card padded={false}>
              {best.map((pr, i) => (
                <View key={pr.id}>
                  {i > 0 && <Divider />}
                  <PRRow pr={pr} highlight />
                </View>
              ))}
            </Card>
            {history.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                <SectionLabel>Histórico</SectionLabel>
                <Card padded={false} style={{ opacity: 0.75 }}>
                  {history.map((pr, i) => (
                    <View key={pr.id}>
                      {i > 0 && <Divider />}
                      <PRRow pr={pr} />
                    </View>
                  ))}
                </Card>
              </View>
            )}
          </>
        )}
      </Screen>
      {adding && <AddPRSheet exercises={query.data.exercises} onClose={() => setAdding(false)} />}
    </>
  );
}

function PRRow({ pr, highlight }: { pr: PR; highlight?: boolean }) {
  const c = useTheme();
  return (
    <View style={styles.prRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.row}>
          <Txt variant={highlight ? 'subheading' : 'label'} numberOfLines={1} style={{ flexShrink: 1 }}>
            {pr.exercise_name}
          </Txt>
          {pr.auto && <Badge label="Auto" fg={c.primary} bg={c.primarySoft} />}
        </View>
        <Txt variant="small" color="muted">
          {formatDate(pr.date)}
          {pr.notes && !pr.auto ? ` · ${pr.notes}` : ''}
        </Txt>
      </View>
      <Text style={[highlight ? font.heading : font.label, font.number, { color: highlight ? c.primary : c.text }]}>
        {formatValue(pr.value, pr.unit)}
      </Text>
    </View>
  );
}

function AddPRSheet({ exercises, onClose }: { exercises: ExerciseOption[]; onClose: () => void }) {
  const c = useTheme();
  const userId = useUserId();
  const add = useAddPR(userId);
  const [search, setSearch] = useState('');
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('reps');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? exercises.filter((e) => e.exercise_name.toLowerCase().includes(q)) : exercises;
  }, [exercises, search]);

  const chosen = exercises.find((e) => e.id === exerciseId);
  const numeric = parseFloat(value.replace(',', '.'));
  const target = custom.trim() || exerciseId;

  function save() {
    if (!target) return setError('Escolha um exercício ou digite o nome.');
    if (!Number.isFinite(numeric) || numeric <= 0) return setError('Informe um valor maior que zero.');
    setError(null);
    add.mutate(
      { exerciseId: target, value: numeric, unit, notes: notes.trim() || null },
      { onSuccess: onClose, onError: () => setError('Não foi possível salvar. Tente de novo.') },
    );
  }

  return (
    <BottomSheet visible onClose={onClose} title="Novo recorde">
      {!chosen && !custom ? (
        <View style={{ gap: spacing.sm }}>
          <Field label="Exercício" placeholder="Buscar" value={search} onChangeText={setSearch} autoCorrect={false} />
          <FlatList
            style={{ maxHeight: 260 }}
            data={filtered}
            keyExtractor={(e) => e.id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={Divider}
            renderItem={({ item }) => (
              <Pressable onPress={() => setExerciseId(item.id)} style={styles.pick}>
                <Txt variant="label">{item.exercise_name}</Txt>
                <Txt variant="small" color="muted">
                  {skillName(item.skill_id)}
                </Txt>
              </Pressable>
            )}
            ListFooterComponent={
              search.trim() ? (
                <Pressable onPress={() => setCustom(search.trim())} style={styles.pick}>
                  <Txt variant="label" color="primary">
                    Usar “{search.trim()}”
                  </Txt>
                </Pressable>
              ) : null
            }
          />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <Pressable
            onPress={() => {
              setExerciseId(null);
              setCustom('');
            }}
            style={[styles.selected, { backgroundColor: c.surfaceMuted }]}
          >
            <Txt variant="subheading" style={{ flex: 1 }}>
              {chosen?.exercise_name ?? custom}
            </Txt>
            <Txt variant="label" color="primary">
              Trocar
            </Txt>
          </Pressable>
          <Field label="Valor" placeholder="Ex.: 10" keyboardType="decimal-pad" value={value} onChangeText={setValue} />
          <View style={styles.row}>
            {UNITS.map((u) => (
              <Chip key={u.value} flex label={u.label} selected={unit === u.value} onPress={() => setUnit(u.value)} />
            ))}
          </View>
          <Field label="Observações (opcional)" placeholder="Ex.: strict, sem kip" value={notes} onChangeText={setNotes} />
          {error && <ErrorBox>{error}</ErrorBox>}
          <Button label="Salvar recorde" onPress={save} loading={add.isPending} />
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  pick: { paddingVertical: spacing.md, gap: 2 },
  selected: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: spacing.md },
});
