import { Ionicons } from '@expo/vector-icons';
import { EXERCISE_EFFORT_LABELS, LEVEL_LABELS, normalizeLevel, skillIcon, skillName } from '@thaix/core';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, EmptyState, ErrorView, LevelBadge, LoadingView, Screen, SectionLabel, Txt } from '@/components/ui';
import { useUserId } from '@/lib/account';
import { useSkillHistory, type HistoryWorkout } from '@/lib/progress';
import { spacing, useTheme } from '@/theme';

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export default function SkillHistoryScreen() {
  const { skillId } = useLocalSearchParams<{ skillId: string }>();
  const c = useTheme();
  const userId = useUserId();
  const history = useSkillHistory(userId, skillId);

  const byWeek = useMemo(() => {
    const groups = new Map<number, HistoryWorkout[]>();
    for (const w of history.data?.workouts ?? []) {
      groups.set(w.week_number, [...(groups.get(w.week_number) ?? []), w]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [history.data]);

  if (history.isPending) return <LoadingView />;
  if (history.isError) return <ErrorView message="Não foi possível carregar o histórico." onRetry={() => history.refetch()} />;

  const p = history.data.progress;

  return (
    <Screen edges={[]} onRefresh={() => history.refetch()} refreshing={history.isRefetching}>
      <Stack.Screen options={{ title: skillName(skillId) }} />
      <View style={styles.header}>
        <Text style={{ fontSize: 40 }}>{skillIcon(skillId)}</Text>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Txt variant="title">{skillName(skillId)}</Txt>
          {p && (
            <View style={styles.row}>
              <LevelBadge level={p.level} />
              <Txt variant="small" color="muted">
                Semana {p.week_number}
              </Txt>
            </View>
          )}
        </View>
      </View>

      {history.data.workouts.length === 0 ? (
        <EmptyState
          emoji="📭"
          title="Nenhum treino concluído ainda"
          message={`Complete seu primeiro treino de ${skillName(skillId)} para ver o histórico aqui.`}
        />
      ) : (
        byWeek.map(([week, workouts]) => {
          const change = history.data.levelChanges.find((l) => l.week_number === week);
          return (
            <View key={week} style={{ gap: spacing.sm }}>
              <SectionLabel
                right={
                  change ? (
                    <Badge label={`Subiu para ${LEVEL_LABELS[normalizeLevel(change.to_level)]}`} fg={c.primary} bg={c.primarySoft} />
                  ) : undefined
                }
              >
                Semana {week}
              </SectionLabel>
              {workouts.map((w) => (
                <Card key={w.id} padded={false}>
                  <View style={[styles.workoutHead, { borderBottomColor: c.border }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.row}>
                        <Txt variant="subheading">{formatDate(w.date)}</Txt>
                        {w.is_redo && <Badge label="Repetição" fg={c.primary} bg={c.primarySoft} />}
                      </View>
                      <Txt variant="small" color="muted">
                        {w.items.length} exercícios
                      </Txt>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => router.push(`/treino/${w.id}?clone=true`)}
                      style={styles.row}
                    >
                      <Txt variant="label" color="primary">
                        Refazer
                      </Txt>
                      <Ionicons name="chevron-forward" size={14} color={c.primary} />
                    </Pressable>
                  </View>
                  {w.items.map((it, i) => (
                    <View key={i} style={styles.item}>
                      <View style={{ flex: 1 }}>
                        <Txt variant="label" numberOfLines={1}>
                          {it.exercise_name}
                        </Txt>
                        <Txt variant="small" color="muted">
                          {it.sets} séries · meta {it.time_sec ? `${it.time_sec}s` : `${it.reps} reps`}
                        </Txt>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        {it.reps_achieved !== null && <Txt variant="label" color="primary">{it.reps_achieved} reps</Txt>}
                        {it.time_achieved_sec !== null && <Txt variant="label" color="primary">{it.time_achieved_sec}s</Txt>}
                        {it.perceived_effort !== null && (
                          <Txt variant="small" color="muted">
                            {EXERCISE_EFFORT_LABELS[it.perceived_effort]}
                          </Txt>
                        )}
                      </View>
                    </View>
                  ))}
                </Card>
              ))}
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  workoutHead: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
