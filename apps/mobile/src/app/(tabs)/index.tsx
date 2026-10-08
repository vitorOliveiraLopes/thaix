import { Ionicons } from '@expo/vector-icons';
import {
  DAILY_EFFORT_SCALE,
  HYDRATION_GOAL_OPTIONS_ML,
  formatMl,
  greeting,
} from '@thaix/core';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  BottomSheet,
  Button,
  Card,
  Chip,
  ErrorBox,
  Screen,
  Txt,
  tapFeedback,
} from '@/components/ui';
import {
  AllDoneCard,
  CompletedWorkoutCard,
  HighEffortBanner,
  RestDayCard,
  TodayHeader,
  WorkoutCard,
} from '@/components/workouts';
import { useAccount, useUserId } from '@/lib/account';
import {
  useHomeStats,
  useSaveDailyEffort,
  useSetHydrationGoal,
  useToggleHydration,
  useTodayPlan,
  useTrainAnyway,
} from '@/lib/home';
import { font, radius, spacing, useTheme } from '@/theme';

const COACH_PHRASES = [
  'Sem pressa, foco na qualidade do movimento.',
  'Hoje é mais um passo. Cada dia conta.',
  'Lembre-se: respirar bem é metade do trabalho.',
  'Você está construindo um corpo forte e duradouro.',
  'Movimento certo, todo dia. É assim que se evolui.',
];

export default function HomeScreen() {
  const c = useTheme();
  const userId = useUserId();
  const account = useAccount();
  const stats = useHomeStats(userId);
  const plan = useTodayPlan(userId);
  const trainAnyway = useTrainAnyway(userId);
  const toggleHydration = useToggleHydration(userId);

  const [effortOpen, setEffortOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([stats.refetch(), plan.refetch()]);
    setRefreshing(false);
  }, [stats, plan]);

  const now = new Date();
  const s = stats.data;
  const p = plan.data;
  const pending = p?.workouts.filter((w) => !w.completed_at) ?? [];
  const completed = p?.workouts.filter((w) => !!w.completed_at) ?? [];

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <View style={{ gap: spacing.xs }}>
        <Txt variant="title">{greeting(now.getHours(), account.data?.profile.name)} 👋</Txt>
        <Txt color="muted">{COACH_PHRASES[now.getDay() % COACH_PHRASES.length]}</Txt>
      </View>

      <View style={styles.statsRow}>
        <Card style={styles.stat}>
          <View style={[styles.statIcon, { backgroundColor: c.primarySoft }]}>
            <Ionicons name="flame" size={16} color={c.primary} />
          </View>
          <Text style={[font.title, font.number, { color: c.text }]}>{s?.streak ?? '–'}</Text>
          <Txt variant="small" color="muted">
            {s?.streak === 1 ? 'dia seguido' : 'dias seguidos'}
          </Txt>
        </Card>

        <Card
          style={styles.stat}
          tone={s?.hydrationMet ? 'primarySoft' : 'surface'}
          onPress={() => {
            if (!s) return;
            tapFeedback();
            toggleHydration.mutate(!s.hydrationMet);
          }}
        >
          <View style={styles.statTop}>
            <View style={[styles.statIcon, { backgroundColor: c.surface }]}>
              <Ionicons name="water" size={16} color={s?.hydrationMet ? c.primary : c.muted} />
            </View>
            <Pressable hitSlop={12} onPress={() => setGoalOpen(true)} accessibilityLabel="Editar meta de água">
              <Ionicons name="pencil" size={13} color={c.muted} />
            </Pressable>
          </View>
          <Txt variant="small" color="muted">
            {s?.hydrationMet ? 'Meta ✓' : 'Água'}
          </Txt>
          <Txt variant="subheading">{s ? formatMl(s.hydrationGoalMl) : '–'}</Txt>
        </Card>

        <Card style={styles.stat} onPress={() => setEffortOpen(true)}>
          <View style={[styles.statIcon, { backgroundColor: c.surfaceMuted }]}>
            <Text style={{ fontSize: 15 }}>{s?.effortToday != null ? DAILY_EFFORT_SCALE[s.effortToday].emoji : '💪'}</Text>
          </View>
          <Txt variant="small" color="muted">
            Esforço
          </Txt>
          <Txt variant="subheading">{s?.effortToday != null ? `${s.effortToday}/10` : 'Registrar'}</Txt>
        </Card>
      </View>

      <TodayHeader />

      {plan.isPending ? (
        <Card style={{ gap: spacing.sm }}>
          <View style={[styles.skeleton, { width: '40%', backgroundColor: c.surfaceMuted }]} />
          <View style={[styles.skeleton, { width: '65%', height: 22, backgroundColor: c.surfaceMuted }]} />
          <View style={[styles.skeleton, { height: 44, backgroundColor: c.surfaceMuted }]} />
        </Card>
      ) : plan.isError ? (
        <ErrorBox>Não foi possível montar seus treinos. Puxe a tela para tentar de novo.</ErrorBox>
      ) : p?.restDay ? (
        <RestDayCard trainingDays={p.trainingDays} onTrainAnyway={() => trainAnyway.mutate()} loading={trainAnyway.isPending} />
      ) : p && p.workouts.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: spacing.xs }}>
          <Txt variant="subheading">Nenhum treino para hoje</Txt>
          <Txt variant="small" color="muted" center>
            Aproveite para descansar e recuperar.
          </Txt>
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {p?.recentAvgEffort != null && p.recentAvgEffort >= 3.5 && <HighEffortBanner avgEffort={p.recentAvgEffort} />}
          {pending.map((w) => (
            <WorkoutCard key={w.id} workout={w} extra={(p?.trainingDays.length ?? 0) > 0 && !p?.trainingDays.includes(now.getDay())} />
          ))}
          {pending.length === 0 && <AllDoneCard />}
          {completed.length > 0 && pending.length > 0 && (
            <Txt variant="caption" color="muted">
              CONCLUÍDOS HOJE
            </Txt>
          )}
          {completed.map((w) => (
            <CompletedWorkoutCard key={w.id} workout={w} />
          ))}
        </View>
      )}

      {/* Montadas só quando abertas, para o estado inicial refletir os dados atuais. */}
      {effortOpen && <DailyEffortSheet visible onClose={() => setEffortOpen(false)} initial={s?.effortToday ?? 0} />}
      {goalOpen && <HydrationGoalSheet visible onClose={() => setGoalOpen(false)} current={s?.hydrationGoalMl ?? 2000} />}
    </Screen>
  );
}

function DailyEffortSheet({ visible, onClose, initial }: { visible: boolean; onClose: () => void; initial: number }) {
  const c = useTheme();
  const userId = useUserId();
  const save = useSaveDailyEffort(userId);
  const [score, setScore] = useState(initial);
  const info = DAILY_EFFORT_SCALE[score];

  return (
    <BottomSheet visible={visible} onClose={onClose} title="PegaLeve 💪" subtitle="Como foi seu esforço hoje?">
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Text style={{ fontSize: 48 }}>{info.emoji}</Text>
        <Txt variant="heading" color="primary">
          {score} · {info.label}
        </Txt>
      </View>
      <View style={styles.scale}>
        {DAILY_EFFORT_SCALE.map((_, i) => (
          <Pressable
            key={i}
            onPress={() => {
              tapFeedback();
              setScore(i);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Esforço ${i}`}
            style={[styles.scaleItem, { backgroundColor: score === i ? c.text : c.surfaceMuted }]}
          >
            <Text style={[font.label, font.number, { color: score === i ? c.background : c.text }]}>{i}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Txt variant="small" color="muted">
          0 · Sem esforço
        </Txt>
        <Txt variant="small" color="muted">
          10 · Máximo
        </Txt>
      </View>
      <Button
        label="Registrar esforço do dia"
        loading={save.isPending}
        onPress={() => save.mutate(score, { onSuccess: onClose })}
      />
    </BottomSheet>
  );
}

function HydrationGoalSheet({ visible, onClose, current }: { visible: boolean; onClose: () => void; current: number }) {
  const userId = useUserId();
  const setGoal = useSetHydrationGoal(userId);
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Meta de hidratação" subtitle="Escolha sua meta diária de água">
      <View style={styles.goals}>
        {HYDRATION_GOAL_OPTIONS_ML.map((ml) => (
          <View key={ml} style={styles.goal}>
            <Chip label={formatMl(ml)} selected={current === ml} onPress={() => setGoal.mutate(ml, { onSuccess: onClose })} />
          </View>
        ))}
      </View>
      <Txt variant="small" color="muted" center>
        Recomendação: entre 2L e 3L por dia para atletas.
      </Txt>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, gap: spacing.xs },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statIcon: { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  skeleton: { height: 14, borderRadius: radius.sm },
  scale: { flexDirection: 'row', gap: 4 },
  scaleItem: { flex: 1, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  goals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  goal: { width: '31%' },
});
