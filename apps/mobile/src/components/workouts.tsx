import { Ionicons } from '@expo/vector-icons';
import { WEEKDAY_SHORT, nextTrainingDay, skillIcon, skillName } from '@thaix/core';
import { router } from 'expo-router';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, Divider, LevelBadge, SectionLabel, Txt } from '@/components/ui';
import type { Workout } from '@/lib/workouts';
import { font, radius, spacing, useTheme } from '@/theme';

const PREVIEW = 4;

export const WorkoutCard = memo(function WorkoutCard({ workout, extra }: { workout: Workout; extra: boolean }) {
  const c = useTheme();
  const [expanded, setExpanded] = useState(false);
  const level = workout.items[0]?.exercise?.level;
  const visible = expanded ? workout.items : workout.items.slice(0, PREVIEW);
  const hidden = workout.items.length - PREVIEW;

  return (
    <Card padded={false}>
      <View style={styles.header}>
        <Text style={{ fontSize: 24 }}>{skillIcon(workout.skill_id)}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.row}>
            <Txt variant="caption" color="primary">
              TREINO DO DIA
            </Txt>
            {extra && <Badge label="Extra" fg={c.warning} bg={c.warningSoft} />}
          </View>
          <Txt variant="heading">{skillName(workout.skill_id)}</Txt>
        </View>
        <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
          {level ? <LevelBadge level={level} /> : null}
          <Txt variant="small" color="muted">
            Semana {workout.week_number}
          </Txt>
        </View>
      </View>
      <Divider />
      {visible.map((item, i) => (
        <View key={`${item.skill_exercise_id}-${i}`} style={styles.exercise}>
          <Txt variant="label" style={{ flex: 1 }} numberOfLines={1}>
            {item.exercise.exercise_name}
          </Txt>
          <Txt variant="small" color="muted" style={font.number}>
            {item.sets}×{item.time_sec ? `${item.time_sec}s` : `${item.reps} reps`}
          </Txt>
        </View>
      ))}
      {hidden > 0 && (
        <Pressable onPress={() => setExpanded((e) => !e)} style={styles.more} accessibilityRole="button">
          <Txt variant="label" color="primary">
            {expanded ? 'Ver menos' : `+${hidden} exercícios`}
          </Txt>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={c.primary} />
        </Pressable>
      )}
      <View style={{ padding: spacing.lg, paddingTop: spacing.sm }}>
        <Button label="Iniciar treino" iconRight="chevron-forward" onPress={() => router.push(`/treino/${workout.id}`)} />
      </View>
    </Card>
  );
});

export function CompletedWorkoutCard({ workout }: { workout: Workout }) {
  const c = useTheme();
  return (
    <Card style={[styles.completed, { opacity: 0.75 }]}>
      <View style={[styles.check, { backgroundColor: c.successSoft }]}>
        <Ionicons name="checkmark" size={18} color={c.success} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="subheading">
          {skillIcon(workout.skill_id)} {skillName(workout.skill_id)}
        </Txt>
        <Txt variant="small" color="muted">
          Concluído hoje · {workout.items.length} exercícios
        </Txt>
      </View>
    </Card>
  );
}

export function RestDayCard({ trainingDays, onTrainAnyway, loading }: { trainingDays: number[]; onTrainAnyway: () => void; loading: boolean }) {
  const next = nextTrainingDay(trainingDays, new Date().getDay());
  return (
    <Card style={{ gap: spacing.md }}>
      <Txt variant="caption" color="muted">
        HOJE
      </Txt>
      <Txt variant="heading">Dia de recuperação 🧘</Txt>
      <Txt color="muted">
        O descanso é parte do treino.
        {next !== null ? (
          <>
            {' '}Seu próximo dia de skill é <Txt variant="subheading">{WEEKDAY_SHORT[next]}</Txt>.
          </>
        ) : null}
      </Txt>
      <Card tone="muted" style={{ gap: spacing.xs }}>
        {['💤 Priorize 7 a 9 horas de sono', '💧 Continue com sua meta de hidratação', '🚶 Caminhada leve ou mobilidade são bem-vindas'].map(
          (tip) => (
            <Txt key={tip} variant="small" color="muted">
              {tip}
            </Txt>
          ),
        )}
      </Card>
      <Button label="Treinar mesmo assim" variant="outline" size="sm" onPress={onTrainAnyway} loading={loading} />
    </Card>
  );
}

export function AllDoneCard() {
  return (
    <Card style={{ alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl }}>
      <Text style={{ fontSize: 32 }}>🎉</Text>
      <Txt variant="heading">Dia completo!</Txt>
      <Txt variant="small" color="muted" center>
        Você concluiu todos os treinos de hoje. Descanse, hidrate-se e volte amanhã mais forte.
      </Txt>
    </Card>
  );
}

export function HighEffortBanner({ avgEffort }: { avgEffort: number }) {
  const high = avgEffort >= 4;
  return (
    <Card tone="warningSoft" style={styles.banner}>
      <Text style={{ fontSize: 20 }}>{high ? '🔥' : '⚡'}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="subheading">{high ? 'Seu corpo está trabalhando muito' : 'Semana intensa'}</Txt>
        <Txt variant="small" color="muted">
          {high
            ? 'Priorizamos exercícios de recuperação hoje. Hidratação e sono fazem parte do treino.'
            : 'O treino de hoje foi ajustado para equilibrar esforço e recuperação.'}
        </Txt>
      </View>
    </Card>
  );
}

/** Cabeçalho "Treinos do dia" com explicação de como se sobe de nível. */
export function TodayHeader() {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionLabel
        right={
          <Pressable
            hitSlop={10}
            onPress={() => setOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel="Como funciona a progressão de nível"
          >
            <Ionicons name={open ? 'close-circle-outline' : 'information-circle-outline'} size={18} color={c.muted} />
          </Pressable>
        }
      >
        Treinos do dia
      </SectionLabel>
      {open && (
        <Card style={{ gap: spacing.md }}>
          <Txt variant="subheading">Como você sobe de nível</Txt>
          <View>
            <View style={styles.levels}>
              <View style={[styles.levelBar, { backgroundColor: c.levelIniciante }]} />
              <View style={[styles.levelBar, { backgroundColor: c.levelIntermediario }]} />
              <View style={[styles.levelBar, { backgroundColor: c.levelAvancado }]} />
            </View>
            <View style={[styles.row, { justifyContent: 'space-between', marginTop: spacing.xs }]}>
              <Text style={[font.caption, { color: c.levelIniciante, letterSpacing: 0 }]}>Iniciante</Text>
              <Text style={[font.caption, { color: c.levelIntermediario, letterSpacing: 0 }]}>Intermediário</Text>
              <Text style={[font.caption, { color: c.levelAvancado, letterSpacing: 0 }]}>Avançado</Text>
            </View>
          </View>
          <Txt variant="small" color="muted">
            Complete a maior parte das séries dentro da meta, em pelo menos 2 treinos seguidos dessa skill.
          </Txt>
          <Txt variant="small" color="muted">
            Se o treino começar a parecer fácil demais, é sinal de que está quase lá.
          </Txt>
          <Txt variant="small" color="muted" style={{ opacity: 0.8 }}>
            A gente acompanha isso automaticamente. Seu próximo treino já vem no nível seguinte quando bater.
          </Txt>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2 },
  more: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  completed: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  check: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  levels: { flexDirection: 'row', height: 8, borderRadius: radius.pill, overflow: 'hidden', gap: 2 },
  levelBar: { flex: 1 },
});
