import { LEVEL_LABELS, normalizeLevel, skillIcon, skillName } from '@thaix/core';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Divider, ErrorView, LoadingView, ProgressBar, Screen, SectionLabel, Txt } from '@/components/ui';
import { useUserId } from '@/lib/account';
import { useAchievements, type AchievementItem } from '@/lib/progress';
import { spacing } from '@/theme';

function unlockedDate(a: AchievementItem) {
  return a.unlocked_at ? new Date(a.unlocked_at).toLocaleDateString('pt-BR') : null;
}

export default function ConquistasScreen() {
  const userId = useUserId();
  const query = useAchievements(userId);

  if (query.isPending) return <LoadingView />;
  if (query.isError) return <ErrorView message="Não foi possível carregar as conquistas." onRetry={() => query.refetch()} />;

  const all = query.data;
  const unlocked = all.filter((a) => a.unlocked_at).length;
  const sessions = all.filter((a) => a.type === 'session_count');
  const levels = all.filter((a) => a.type === 'skill_level');
  const exercises = all.filter((a) => a.type === 'skill_exercise');

  return (
    <Screen edges={[]} onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
      <Card>
        <Txt variant="heading">
          {unlocked} de {all.length} desbloqueadas
        </Txt>
        <ProgressBar value={all.length ? unlocked / all.length : 0} height={8} />
      </Card>

      {sessions.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <SectionLabel>Treinos concluídos</SectionLabel>
          <View style={styles.grid}>
            {sessions.map((a) => (
              <Card key={a.id} style={[styles.tile, !a.unlocked_at && styles.locked]}>
                <Text style={{ fontSize: 26 }}>{a.unlocked_at ? '🏆' : '🔒'}</Text>
                <Txt variant="label" center>
                  {a.name}
                </Txt>
                {a.threshold ? (
                  <Txt variant="small" color="muted" center>
                    {a.threshold} treinos
                  </Txt>
                ) : null}
                {unlockedDate(a) && (
                  <Txt variant="small" color="muted" center>
                    {unlockedDate(a)}
                  </Txt>
                )}
              </Card>
            ))}
          </View>
        </View>
      )}

      {levels.length > 0 && (
        <Section title="Progressão de skill" items={levels} icon={(a) => (a.unlocked_at ? skillIcon(a.skill_id ?? '') : '🔒')} subtitle={(a) => `${skillName(a.skill_id ?? '')}${a.target_level ? ` → ${LEVEL_LABELS[normalizeLevel(a.target_level)]}` : ''}`} />
      )}
      {exercises.length > 0 && (
        <Section title="Exercícios desbloqueados" items={exercises} icon={(a) => (a.unlocked_at ? '✅' : '🔒')} subtitle={(a) => a.description ?? ''} />
      )}
    </Screen>
  );
}

function Section({
  title,
  items,
  icon,
  subtitle,
}: {
  title: string;
  items: AchievementItem[];
  icon: (a: AchievementItem) => string;
  subtitle: (a: AchievementItem) => string;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionLabel>{title}</SectionLabel>
      <Card padded={false}>
        {items.map((a, i) => (
          <View key={a.id}>
            {i > 0 && <Divider />}
            <View style={[styles.row, !a.unlocked_at && styles.locked]}>
              <Text style={{ fontSize: 20 }}>{icon(a)}</Text>
              <View style={{ flex: 1 }}>
                <Txt variant="subheading">{a.name}</Txt>
                {subtitle(a) ? (
                  <Txt variant="small" color="muted" numberOfLines={1}>
                    {subtitle(a)}
                  </Txt>
                ) : null}
              </View>
              {unlockedDate(a) && (
                <Txt variant="small" color="muted">
                  {unlockedDate(a)}
                </Txt>
              )}
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '31.5%', alignItems: 'center', gap: spacing.xs },
  locked: { opacity: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
});
