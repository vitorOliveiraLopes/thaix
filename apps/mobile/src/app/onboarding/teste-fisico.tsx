import { useState } from 'react';
import { View } from 'react-native';

import { NumberSlider } from '@/components/inputs';
import { OnboardingShell, WithAnswers, useAdvance } from '@/components/onboarding';
import { CoachBubble } from '@/components/ui';
import type { OnboardingAnswers } from '@/lib/onboarding';
import { recommendProtocol } from '@thaix/core';
import { spacing } from '@/theme';

const EXERCISES = [
  { key: 'pushups', emoji: '💪', label: 'Push-ups strict', max: 30 },
  { key: 'pullups', emoji: '🏋️', label: 'Pull-ups strict', max: 20 },
  { key: 'squats', emoji: '🦵', label: 'Air squats', max: 50 },
] as const;

type Values = Record<(typeof EXERCISES)[number]['key'], number>;

function TesteForm({ answers }: { answers: OnboardingAnswers | null }) {
  const advance = useAdvance('teste-fisico');
  const [values, setValues] = useState<Values>(() => ({
    pushups: answers?.pushups ?? 0,
    pullups: answers?.pullups ?? 0,
    squats: answers?.squats ?? 0,
  }));

  return (
    <OnboardingShell
      step="teste-fisico"
      onSubmit={() =>
        advance({
          ...values,
          protocol_recommended: recommendProtocol(values.pushups, values.pullups, values.squats),
        })
      }
    >
      <CoachBubble
        title="Teste físico rápido"
        subtitle="Reps seguidas, com forma limpa. Esses números viram o ponto de partida das suas trilhas."
      />
      <View style={{ gap: spacing.md }}>
        {EXERCISES.map((ex) => (
          <NumberSlider
            key={ex.key}
            emoji={ex.emoji}
            label={ex.label}
            hint="Reps unbroken"
            max={ex.max}
            value={values[ex.key]}
            onChange={(v) => setValues((prev) => ({ ...prev, [ex.key]: v }))}
          />
        ))}
      </View>
    </OnboardingShell>
  );
}

export default function TesteFisico() {
  return <WithAnswers>{(a) => <TesteForm answers={a} />}</WithAnswers>;
}
