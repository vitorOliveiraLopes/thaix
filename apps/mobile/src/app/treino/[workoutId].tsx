import { Ionicons } from '@expo/vector-icons';
import {
  EXERCISE_EFFORT_LABELS,
  bestRecorded,
  buildCompletionPayload,
  canAdvance,
  emptySets,
  filledCount,
  logKey,
  skillName,
  toLocalISODate,
  type ExerciseLog,
  type SetValues,
} from '@thaix/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AchievementModal } from '@/components/achievement-modal';
import { RepsSets, TimedSets } from '@/components/sets';
import {
  Button,
  Card,
  ErrorBox,
  ErrorView,
  IconButton,
  LoadingView,
  ProgressBar,
  Screen,
  Txt,
  tapFeedback,
} from '@/components/ui';
import { useUserId } from '@/lib/account';
import { apiPost } from '@/lib/api';
import { qk } from '@/lib/query';
import { cloneWorkout, fetchWorkout, type Workout } from '@/lib/workouts';
import { confirmAction } from '@/lib/confirm';
import { font, radius, spacing, useTheme } from '@/theme';

type CompleteResponse = { success: boolean; newAchievements?: string[] };

/**
 * "Refazer" chega com ?clone=true: cria o treino de hoje a partir do antigo
 * e troca a rota para ele, assim voltar não reabre a clonagem.
 */
function CloneRedirect({ originalId }: { originalId: string }) {
  const userId = useUserId();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    cloneWorkout(userId, originalId)
      .then((id) => router.replace(`/treino/${id}`))
      .catch(() => setError('Não foi possível preparar o treino. Tente de novo.'));
  }, [userId, originalId]);

  if (error) return <ErrorView message={error} onRetry={() => router.back()} />;
  return <LoadingView />;
}

export default function WorkoutRoute() {
  const { workoutId, clone } = useLocalSearchParams<{ workoutId: string; clone?: string }>();
  if (clone === 'true') return <CloneRedirect originalId={workoutId} />;
  return <WorkoutLoader workoutId={workoutId} />;
}

function WorkoutLoader({ workoutId }: { workoutId: string }) {
  const query = useQuery({ queryKey: qk.workout(workoutId), queryFn: () => fetchWorkout(workoutId) });
  if (query.isPending) return <LoadingView />;
  if (query.isError || !query.data) return <ErrorView message="Treino não encontrado." onRetry={() => query.refetch()} />;
  if (query.data.items.length === 0) return <ErrorView message="Este treino não tem exercícios." onRetry={() => router.back()} />;
  return <WorkoutSession workout={query.data} />;
}

function WorkoutSession({ workout }: { workout: Workout }) {
  useKeepAwake(); // a tela não apaga no meio do treino
  const c = useTheme();
  const userId = useUserId();
  const client = useQueryClient();

  const [index, setIndex] = useState(0);
  const [logs, setLogs] = useState<Record<string, ExerciseLog>>({});
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const navigation = useNavigation();
  const leaving = useRef(false);

  // Bloqueia sair com séries registradas e não salvas: botão voltar do
  // Android, gesto e o X. Depois de salvar, a saída é liberada.
  const unsaved = Object.keys(logs).length > 0 && !saved;
  usePreventRemove(unsaved, ({ data }) => {
    if (leaving.current) {
      navigation.dispatch(data.action);
      return;
    }
    confirmAction({
      title: 'Sair do treino?',
      message: 'O que você registrou até agora não será salvo.',
      confirmText: 'Sair',
      cancelText: 'Continuar treinando',
      destructive: true,
    }).then((sair) => {
      if (!sair) return;
      leaving.current = true;
      navigation.dispatch(data.action);
    });
  });

  const left = useRef(false);
  function leave() {
    if (left.current) return; // evita voltar duas telas
    left.current = true;
    leaving.current = true;
    router.back();
  }

  const item = workout.items[index];
  const total = workout.items.length;
  const isLast = index === total - 1;
  const timeBased = !!item.time_sec;
  const totalSets = Math.max(1, item.sets ?? 1);
  const key = logKey(item.skill_exercise_id, index);
  const log = logs[key];
  const values: SetValues = (timeBased ? log?.time_per_set : log?.reps_per_set) ?? emptySets(totalSets);
  const anyFilled = filledCount(values) > 0;
  const ready = canAdvance(log, totalSets, timeBased);

  function updateLog(patch: Partial<ExerciseLog>) {
    setLogs((prev) => ({
      ...prev,
      [key]: { ...prev[key], skill_exercise_id: item.skill_exercise_id, ...patch },
    }));
  }

  function setValues(next: SetValues) {
    updateLog(timeBased ? { time_per_set: next } : { reps_per_set: next });
  }

  // A confirmação fica no usePreventRemove, que cobre todas as formas de sair.
  function exit() {
    router.back();
  }

  async function finish() {
    if (saving || saved) return;
    setSaving(true);
    setError(null);
    try {
      const results = buildCompletionPayload(workout.items.map((it, i) => logs[logKey(it.skill_exercise_id, i)]).filter(Boolean));
      const res = await apiPost<CompleteResponse>('/api/workouts/complete', { workoutId: workout.id, results });
      // Salvo: a conclusão não pode ser enviada de novo (contaria a sessão duas vezes).
      setSaved(true);
      leaving.current = true;
      // Tudo que depende do treino concluído precisa recarregar.
      await Promise.all([
        client.invalidateQueries({ queryKey: qk.todayWorkouts(userId, toLocalISODate()) }),
        client.invalidateQueries({ queryKey: qk.home(userId) }),
        client.invalidateQueries({ queryKey: qk.progress(userId) }),
        client.invalidateQueries({ queryKey: qk.skillProgress(userId) }),
        client.invalidateQueries({ queryKey: ['skill-history', userId] }),
        client.invalidateQueries({ queryKey: qk.prs(userId) }),
        client.invalidateQueries({ queryKey: qk.achievements(userId) }),
        client.invalidateQueries({ queryKey: qk.workout(workout.id) }),
      ]);
      if (res.newAchievements && res.newAchievements.length > 0) setAchievements(res.newAchievements);
      else leave();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar o treino.');
    } finally {
      setSaving(false);
    }
  }

  const summary = useMemo(
    () =>
      workout.items.map((it, i) => {
        const l = logs[logKey(it.skill_exercise_id, i)];
        return { it, reps: bestRecorded(l?.reps_per_set), time: bestRecorded(l?.time_per_set), effort: l?.perceived_effort };
      }),
    [workout.items, logs],
  );

  // ─── Resumo final ───────────────────────────────────────────────────────────

  if (done) {
    return (
      <Screen
        edges={['top', 'bottom']}
        footer={
          <>
            {error && <ErrorBox>{error}</ErrorBox>}
            {saved ? (
              <Button label="Voltar para o início" onPress={leave} />
            ) : (
              <>
                <Button label={error ? 'Tentar salvar de novo' : 'Finalizar e salvar'} onPress={finish} loading={saving} />
                {!saving && <Button label="Voltar aos exercícios" variant="ghost" onPress={() => setDone(false)} />}
              </>
            )}
          </>
        }
      >
        <View style={styles.doneHero}>
          <View style={[styles.doneIcon, { backgroundColor: c.primarySoft }]}>
            <Ionicons name="checkmark-done" size={40} color={c.primary} />
          </View>
          <Txt variant="title" center>
            Treino concluído!
          </Txt>
          <Txt color="muted" center>
            {skillName(workout.skill_id)} · {total} exercícios
          </Txt>
        </View>
        <Card padded={false}>
          {summary.map(({ it, reps, time, effort }, i) => (
            <View key={logKey(it.skill_exercise_id, i)} style={[styles.summaryRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
              <Txt variant="label" style={{ flex: 1 }}>
                {it.exercise.exercise_name}
              </Txt>
              <View style={{ alignItems: 'flex-end' }}>
                {reps !== undefined && <Txt variant="label" color="primary">melhor série: {reps} reps</Txt>}
                {time !== undefined && <Txt variant="label" color="primary">melhor série: {time}s</Txt>}
                {effort !== undefined && (
                  <Txt variant="small" color="muted">
                    {EXERCISE_EFFORT_LABELS[effort]}
                  </Txt>
                )}
              </View>
            </View>
          ))}
        </Card>
        {achievements && (
          <AchievementModal
            ids={achievements}
            onClose={() => {
              setAchievements(null);
              leave();
            }}
          />
        )}
      </Screen>
    );
  }

  // ─── Execução ───────────────────────────────────────────────────────────────

  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        <View style={styles.nav}>
          {index > 0 && (
            <Button label="Voltar" variant="outline" icon="chevron-back" onPress={() => setIndex((i) => i - 1)} style={{ paddingHorizontal: spacing.lg }} />
          )}
          {ready ? (
            <Button
              label={isLast ? 'Concluir treino' : 'Próximo'}
              iconRight={isLast ? 'checkmark' : 'chevron-forward'}
              onPress={() => {
                tapFeedback();
                if (isLast) setDone(true);
                else setIndex((i) => i + 1);
              }}
              style={{ flex: 1 }}
            />
          ) : (
            <View style={[styles.hint, { backgroundColor: c.surfaceMuted }]}>
              <Txt variant="small" color="muted" center>
                {anyFilled ? 'Registre todas as séries e diga como foi' : 'Registre suas séries para avançar'}
              </Txt>
            </View>
          )}
        </View>
      }
    >
      <View style={styles.topBar}>
        <IconButton icon="close" label="Sair do treino" onPress={exit} color={c.muted} />
        <Txt variant="label" color="muted" style={font.number}>
          {index + 1} de {total}
        </Txt>
        <View style={{ width: 30 }} />
      </View>
      <ProgressBar value={(index + 1) / total} />

      <Card>
        <Txt variant="caption" color="primary" style={{ textTransform: 'uppercase' }}>
          {item.exercise.category}
        </Txt>
        <Txt variant="title">{item.exercise.exercise_name}</Txt>
        <Txt color="muted">
          {totalSets} série{totalSets > 1 ? 's' : ''}
        </Txt>
        {item.exercise.note ? (
          <View style={[styles.note, { borderTopColor: c.border }]}>
            <Txt variant="small" color="muted">
              💡 {item.exercise.note}
            </Txt>
          </View>
        ) : null}
      </Card>

      {timeBased ? (
        <TimedSets key={`timer-${index}`} targetSec={item.time_sec!} values={values} onChange={setValues} />
      ) : (
        <RepsSets values={values} onChange={setValues} />
      )}

      {totalSets > 1 && item.exercise.rest_sec > 0 && (
        <View style={[styles.rest, { backgroundColor: c.surfaceMuted }]}>
          <Ionicons name="hourglass-outline" size={16} color={c.muted} />
          <Txt variant="small" color="muted">
            Descanso recomendado: {item.exercise.rest_sec}s entre séries
          </Txt>
        </View>
      )}

      {anyFilled && (
        <Card>
          <Txt variant="subheading">Como foi?</Txt>
          <View style={styles.effortRow}>
            {[1, 2, 3, 4, 5].map((n) => {
              const selected = log?.perceived_effort === n;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={EXERCISE_EFFORT_LABELS[n]}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    tapFeedback();
                    updateLog({ perceived_effort: n });
                  }}
                  style={[styles.effort, { backgroundColor: selected ? c.primary : c.surfaceMuted }]}
                >
                  <Text style={[font.subheading, { color: selected ? c.onPrimary : c.muted }]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.topBar, { paddingHorizontal: spacing.xs }]}>
            <Txt variant="small" color="muted">
              Muito fácil
            </Txt>
            <Txt variant="small" color="muted">
              Muito difícil
            </Txt>
          </View>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  hint: { flex: 1, minHeight: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  note: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, marginTop: spacing.xs },
  rest: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, padding: spacing.md },
  effortRow: { flexDirection: 'row', gap: spacing.sm },
  effort: { flex: 1, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  doneHero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  doneIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
});
