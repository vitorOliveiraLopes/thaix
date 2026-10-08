import { Ionicons } from '@expo/vector-icons';
import { skillIcon, skillName } from '@thaix/core';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EffortChart, MonthCalendar } from '@/components/charts';
import { Card, Divider, ErrorBox, LevelBadge, ListRow, LoadingView, Screen, SectionLabel, Txt } from '@/components/ui';
import { useUserId } from '@/lib/account';
import { useProgressOverview, useSkillProgress } from '@/lib/progress';
import { font, spacing, useTheme } from '@/theme';

export default function DesempenhoScreen() {
  const c = useTheme();
  const userId = useUserId();
  const overview = useProgressOverview(userId);
  const skills = useSkillProgress(userId);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([overview.refetch(), skills.refetch()]);
    setRefreshing(false);
  }, [overview, skills]);

  const sets = useMemo(() => {
    const o = overview.data;
    return {
      workouts: new Set(o?.workoutDates ?? []),
      hydration: new Set(o?.hydrationDates ?? []),
      efforts: new Map((o?.effortLogs ?? []).map((l) => [l.date, l.score])),
    };
  }, [overview.data]);

  if (overview.isPending) return <LoadingView />;

  const o = overview.data;
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const metrics = [
    { icon: 'barbell' as const, value: o?.totalWorkouts ?? 0, label: 'treinos', color: c.primary },
    { icon: 'water' as const, value: o?.hydrationDates.length ?? 0, label: 'dias com água em dia', color: c.info },
    { icon: 'flame' as const, value: o?.currentStreak ?? 0, label: 'sequência atual', color: c.primary },
    { icon: 'trophy' as const, value: o?.maxStreak ?? 0, label: 'maior sequência', color: c.muted },
  ];

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <Txt variant="title">Desempenho</Txt>
      {overview.isError && <ErrorBox>Não foi possível carregar seu histórico. Puxe para tentar de novo.</ErrorBox>}

      {(skills.data?.length ?? 0) > 0 && (
        <View style={{ gap: spacing.sm }}>
          <SectionLabel>Suas skills</SectionLabel>
          {skills.data!.map((s) => (
            <Card key={s.skill_id} onPress={() => router.push(`/skill/${s.skill_id}`)} style={styles.skill}>
              <Text style={{ fontSize: 26 }}>{skillIcon(s.skill_id)}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="subheading">{skillName(s.skill_id)}</Txt>
                <Txt variant="small" color="muted">
                  Semana {s.week_number} · {s.sessions_at_current_level} {s.sessions_at_current_level === 1 ? 'sessão' : 'sessões'} neste nível
                </Txt>
              </View>
              <LevelBadge level={s.level} />
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Card>
          ))}
        </View>
      )}

      <View style={styles.metrics}>
        {metrics.map((m) => (
          <Card key={m.label} style={styles.metric}>
            <Ionicons name={m.icon} size={18} color={m.color} />
            <Text style={[font.title, font.number, { color: c.text }]}>{m.value}</Text>
            <Txt variant="small" color="muted">
              {m.label}
            </Txt>
          </Card>
        ))}
      </View>

      <Card style={{ gap: spacing.lg }}>
        <MonthCalendar year={prev.getFullYear()} month={prev.getMonth()} workoutDates={sets.workouts} hydrationDates={sets.hydration} efforts={sets.efforts} />
        <Divider />
        <MonthCalendar year={now.getFullYear()} month={now.getMonth()} workoutDates={sets.workouts} hydrationDates={sets.hydration} efforts={sets.efforts} />
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDay, { backgroundColor: c.primary }]} />
            <Txt variant="small" color="muted">
              Treino
            </Txt>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: c.info }]} />
            <Txt variant="small" color="muted">
              Água
            </Txt>
          </View>
          <View style={styles.legendItem}>
            <Text>😄</Text>
            <Txt variant="small" color="muted">
              Como você se sentiu
            </Txt>
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Txt variant="heading">Como você se sentiu</Txt>
          <Txt variant="small" color="muted">
            {o?.effortLogs.length ?? 0} registros
          </Txt>
        </View>
        <EffortChart logs={o?.effortLogs ?? []} />
      </Card>

      <Card padded={false}>
        <ListRow emoji="🏆" title="Conquistas" subtitle="Tudo o que você já desbloqueou" onPress={() => router.push('/conquistas')} />
        <Divider />
        <ListRow emoji="🥇" title="Recordes pessoais" subtitle="Seus melhores resultados" onPress={() => router.push('/prs')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skill: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { width: '48.5%', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDay: { width: 14, height: 14, borderRadius: 7 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
