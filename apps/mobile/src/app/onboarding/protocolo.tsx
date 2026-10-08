import { LEVEL_LABELS, SKILLS, initialSkillLevel, isSkillId } from '@thaix/core';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { OnboardingShell, WithAnswers } from '@/components/onboarding';
import { Button, Card, LevelBadge, SectionLabel, Txt } from '@/components/ui';
import { useUserId } from '@/lib/account';
import { completeOnboarding, type OnboardingAnswers } from '@/lib/onboarding';
import { qk } from '@/lib/query';
import { font, radius, spacing, useTheme } from '@/theme';

const LEVEL_COPY = {
  iniciante: '28 dias para construir a base: padrão de movimento e força inicial.',
  intermediario: '28 dias com mais volume e introdução às primeiras skills.',
  avancado: '28 dias avançados: muscle-up, handstand e força máxima.',
} as const;

const PHASES = ['Fundação', 'Estrutura', 'Potência', 'Maestria'];

function Resumo({ answers }: { answers: OnboardingAnswers | null }) {
  const c = useTheme();
  const userId = useUserId();
  const client = useQueryClient();
  const level = initialSkillLevel(answers?.pushups ?? 0, answers?.pullups ?? 0);
  const skills = (answers?.skills ?? []).filter(isSkillId);
  const days = answers?.dias_semana?.length ?? 0;

  async function finish() {
    await completeOnboarding(userId);
    // A conta recarregada libera o app; o layout mostra os planos em seguida.
    await client.invalidateQueries({ queryKey: qk.account(userId) });
  }

  return (
    <OnboardingShell
      step="protocolo"
      submitLabel="Começar"
      onSubmit={finish}
      secondary={<Button label="Refazer o teste" variant="ghost" onPress={() => router.navigate('/onboarding/teste-fisico')} />}
    >
      <View style={{ gap: spacing.xs }}>
        <Txt variant="caption" color="primary">
          SUA TRILHA DE SKILL
        </Txt>
        <Txt variant="title">Sua trilha inicial</Txt>
        <Txt color="muted">Recomendada a partir do seu teste. Sua evolução ajusta o nível automaticamente.</Txt>
      </View>

      <Card style={{ borderColor: c.primary, borderWidth: 2 }}>
        <View style={styles.rowBetween}>
          <Txt variant="heading">Treinos {LEVEL_LABELS[level]}</Txt>
          <LevelBadge level={level} />
        </View>
        <Txt variant="small" color="muted">
          {LEVEL_COPY[level]}
        </Txt>
        <View style={styles.stats}>
          {[
            { v: `${days || 4}×`, l: 'por semana' },
            { v: `${answers?.session_minutes ?? 45} min`, l: 'por sessão' },
            { v: `${skills.length}`, l: skills.length === 1 ? 'skill' : 'skills' },
          ].map((s) => (
            <View key={s.l} style={[styles.stat, { backgroundColor: c.surfaceMuted }]}>
              <Text style={[font.subheading, font.number, { color: c.text }]}>{s.v}</Text>
              <Txt variant="small" color="muted">
                {s.l}
              </Txt>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <SectionLabel>Suas trilhas</SectionLabel>
        {skills.map((id) => (
          <View key={id} style={styles.rowBetween}>
            <Txt variant="subheading">
              {SKILLS[id].icon} {SKILLS[id].name}
            </Txt>
            <LevelBadge level={level} />
          </View>
        ))}
      </Card>

      <Card>
        <SectionLabel>4 blocos de progressão</SectionLabel>
        <View style={styles.phases}>
          {PHASES.map((p, i) => (
            <View key={p} style={styles.phase}>
              <View style={[styles.phaseBar, { backgroundColor: i === 0 ? c.primary : c.border }]} />
              <Txt variant="small" color="muted" center>
                {p}
              </Txt>
            </View>
          ))}
        </View>
      </Card>
    </OnboardingShell>
  );
}

export default function Protocolo() {
  return <WithAnswers>{(a) => <Resumo answers={a} />}</WithAnswers>;
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  phases: { flexDirection: 'row', gap: spacing.xs },
  phase: { flex: 1, gap: spacing.xs },
  phaseBar: { height: 6, borderRadius: 3 },
});
