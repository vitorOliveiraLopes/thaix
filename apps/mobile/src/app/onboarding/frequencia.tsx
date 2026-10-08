import { MIN_TRAINING_DAYS, SESSION_MINUTES_OPTIONS, WEEKDAY_SHORT } from '@thaix/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TimeField } from '@/components/inputs';
import { OnboardingShell, WithAnswers, useAdvance } from '@/components/onboarding';
import { Card, Chip, CoachBubble, Divider, ListRow, LoadingView, SectionLabel, Txt } from '@/components/ui';
import { DEFAULT_NOTIFICATIONS, useUserId, type NotificationSettings } from '@/lib/account';
import { saveNotificationTimes, type OnboardingAnswers } from '@/lib/onboarding';
import { supabase } from '@/lib/supabase';
import { spacing } from '@/theme';

function FrequenciaForm({ answers, notifications }: { answers: OnboardingAnswers | null; notifications: NotificationSettings }) {
  const userId = useUserId();
  const advance = useAdvance('frequencia');

  const [days, setDays] = useState<number[]>(() =>
    answers?.dias_semana && answers.dias_semana.length > 0 ? answers.dias_semana : [1, 2, 4, 6],
  );
  const [minutes, setMinutes] = useState<number | null>(() => answers?.session_minutes ?? null);
  const [workoutTime, setWorkoutTime] = useState(notifications.workout.time);
  const [hydrationTime, setHydrationTime] = useState(notifications.hydration.time);

  function toggleDay(d: number) {
    setDays((prev) => {
      const active = prev.includes(d);
      if (active && prev.length <= MIN_TRAINING_DAYS) return prev;
      return active ? prev.filter((x) => x !== d) : [...prev, d];
    });
  }

  const sorted = [...days].sort((a, b) => a - b);

  return (
    <OnboardingShell
      step="frequencia"
      canContinue={days.length >= MIN_TRAINING_DAYS && minutes !== null}
      onSubmit={async () => {
        await saveNotificationTimes(userId, workoutTime, hydrationTime);
        await advance({ frequencia: sorted.length, dias_semana: sorted, session_minutes: minutes });
      }}
    >
      <CoachBubble
        title="Quando e quanto você consegue treinar?"
        subtitle="Escolha seus dias de skill e o tempo de cada sessão. Dá para mudar depois."
      />

      <Card>
        <SectionLabel>Seus dias de skill</SectionLabel>
        <View style={styles.row}>
          {WEEKDAY_SHORT.map((label, i) => (
            <Chip key={label} flex label={label} selected={days.includes(i)} onPress={() => toggleDay(i)} />
          ))}
        </View>
        <Txt variant="small" color="muted">
          <Txt variant="label">{sorted.length}×/semana:</Txt> {sorted.map((d) => WEEKDAY_SHORT[d]).join(', ')}
        </Txt>
      </Card>

      <Card>
        <SectionLabel>Tempo por sessão</SectionLabel>
        <View style={styles.row}>
          {SESSION_MINUTES_OPTIONS.map((m) => (
            <Chip key={m} flex label={`${m} min`} selected={minutes === m} onPress={() => setMinutes(m)} />
          ))}
        </View>
        {minutes === null && (
          <Txt variant="small" color="muted">
            Escolha quanto tempo você tem em cada treino.
          </Txt>
        )}
      </Card>

      <Card padded={false}>
        <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
          <SectionLabel>Lembretes diários</SectionLabel>
        </View>
        <ListRow
          icon="alarm-outline"
          title="Treino"
          subtitle="Nos seus dias de skill"
          right={<TimeField label="Horário do treino" value={workoutTime} onChange={setWorkoutTime} />}
        />
        <Divider />
        <ListRow
          emoji="💧"
          title="Hidratação"
          subtitle="Lembrete diário de água"
          right={<TimeField label="Horário da hidratação" value={hydrationTime} onChange={setHydrationTime} />}
        />
      </Card>

      <Card tone="primarySoft">
        <Txt variant="small">
          <Txt variant="label" color="primary">
            Atletas com lembrete ativo
          </Txt>{' '}
          têm muito mais chance de manter o ritmo.
        </Txt>
      </Card>
    </OnboardingShell>
  );
}

export default function Frequencia() {
  const userId = useUserId();
  const notifications = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      const { data } = await supabase.from('user_settings').select('notifications').eq('user_id', userId).maybeSingle();
      return { ...DEFAULT_NOTIFICATIONS, ...(data?.notifications ?? {}) } as NotificationSettings;
    },
  });
  if (notifications.isPending) return <LoadingView />;
  return (
    <WithAnswers>
      {(a) => <FrequenciaForm answers={a} notifications={notifications.data ?? DEFAULT_NOTIFICATIONS} />}
    </WithAnswers>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
});
