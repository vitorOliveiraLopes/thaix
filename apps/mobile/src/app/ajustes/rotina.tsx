import { EQUIPMENT_OPTIONS, MIN_TRAINING_DAYS, SESSION_MINUTES_OPTIONS, WEEKDAY_SHORT } from '@thaix/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { WithAnswers } from '@/components/onboarding';
import { Button, Card, Chip, ErrorBox, OptionRow, Screen, SectionLabel, Txt } from '@/components/ui';
import { useUserId } from '@/lib/account';
import type { OnboardingAnswers } from '@/lib/onboarding';
import { useUpdateRoutine } from '@/lib/settings';
import { spacing } from '@/theme';

function RoutineForm({ answers }: { answers: OnboardingAnswers | null }) {
  const userId = useUserId();
  const update = useUpdateRoutine(userId);
  const [days, setDays] = useState<number[]>(() => answers?.dias_semana ?? [1, 3, 5]);
  const [minutes, setMinutes] = useState<number>(() => answers?.session_minutes ?? 45);
  const [equipment, setEquipment] = useState<string[]>(() => answers?.equipment ?? []);

  function toggleDay(d: number) {
    setDays((prev) => {
      const on = prev.includes(d);
      if (on && prev.length <= MIN_TRAINING_DAYS) return prev;
      return on ? prev.filter((x) => x !== d) : [...prev, d];
    });
  }

  const valid = days.length >= MIN_TRAINING_DAYS && equipment.length > 0;

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          {update.isError && <ErrorBox>Não foi possível salvar. Tente de novo.</ErrorBox>}
          <Button
            label="Salvar rotina"
            disabled={!valid}
            loading={update.isPending}
            onPress={() =>
              update.mutate(
                { dias_semana: [...days].sort((a, b) => a - b), session_minutes: minutes, equipment },
                { onSuccess: () => router.back() },
              )
            }
          />
        </>
      }
    >
      <Card>
        <SectionLabel>Dias de skill</SectionLabel>
        <View style={styles.row}>
          {WEEKDAY_SHORT.map((l, i) => (
            <Chip key={l} flex label={l} selected={days.includes(i)} onPress={() => toggleDay(i)} />
          ))}
        </View>
        <Txt variant="small" color="muted">
          Mínimo de {MIN_TRAINING_DAYS} dias. Mudanças valem a partir do próximo treino gerado.
        </Txt>
      </Card>

      <Card>
        <SectionLabel>Tempo por sessão</SectionLabel>
        <View style={styles.row}>
          {SESSION_MINUTES_OPTIONS.map((m) => (
            <Chip key={m} flex label={`${m} min`} selected={minutes === m} onPress={() => setMinutes(m)} />
          ))}
        </View>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <SectionLabel>Equipamento disponível</SectionLabel>
        {EQUIPMENT_OPTIONS.map((e) => (
          <OptionRow
            key={e.id}
            multi
            label={e.label}
            emoji={e.icon}
            selected={equipment.includes(e.id)}
            onPress={() => setEquipment((prev) => (prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id]))}
          />
        ))}
      </View>
    </Screen>
  );
}

export default function RotinaScreen() {
  return <WithAnswers>{(a) => <RoutineForm answers={a} />}</WithAnswers>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
});
