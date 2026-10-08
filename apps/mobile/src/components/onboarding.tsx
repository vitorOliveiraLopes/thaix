import { ONBOARDING_STEPS, nextOnboardingStep, type OnboardingStep } from '@thaix/core';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, CoachBubble, ErrorBox, ErrorView, IconButton, LoadingView, OptionRow, Screen } from '@/components/ui';
import { useUserId } from '@/lib/account';
import { saveStep, useOnboardingAnswers, type OnboardingAnswers } from '@/lib/onboarding';
import { qk } from '@/lib/query';
import { spacing, useTheme } from '@/theme';

/** Barra de etapas + voltar, no topo de cada tela do onboarding. */
function OnboardingHeader({ step }: { step: OnboardingStep }) {
  const c = useTheme();
  const index = ONBOARDING_STEPS.indexOf(step);
  return (
    <View style={styles.header}>
      {index > 0 && router.canGoBack() ? (
        <IconButton icon="chevron-back" label="Voltar" onPress={() => router.back()} color={c.muted} />
      ) : (
        <View style={{ width: 30 }} />
      )}
      <View style={styles.segments} accessibilityLabel={`Etapa ${index + 1} de ${ONBOARDING_STEPS.length}`}>
        {ONBOARDING_STEPS.map((s, i) => (
          <View key={s} style={[styles.segment, { backgroundColor: i <= index ? c.primary : c.border }]} />
        ))}
      </View>
    </View>
  );
}

/**
 * Estrutura comum das telas do onboarding: cabeçalho, conteúdo rolável e
 * botão fixo no rodapé. `onSubmit` grava e avança; erros aparecem acima do botão.
 */
export function OnboardingShell({
  step,
  children,
  canContinue = true,
  submitLabel = 'Continuar',
  onSubmit,
  secondary,
}: {
  step: OnboardingStep;
  children: ReactNode;
  canContinue?: boolean;
  submitLabel?: string;
  onSubmit: () => Promise<void>;
  secondary?: ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit();
    } catch (e) {
      setError(e instanceof Error && e.message ? traduzir(e.message) : 'Não foi possível salvar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        <>
          {error && <ErrorBox>{error}</ErrorBox>}
          <Button label={submitLabel} onPress={handle} loading={saving} disabled={!canContinue} />
          {secondary}
        </>
      }
    >
      <OnboardingHeader step={step} />
      {children}
    </Screen>
  );
}

function traduzir(message: string): string {
  if (/network|fetch/i.test(message)) return 'Sem conexão. Confira sua internet e tente de novo.';
  if (/column .* does not exist/i.test(message)) return 'O banco ainda não tem os campos novos. Rode o SQL add_onboarding_routine_fields.sql no Supabase.';
  return message;
}

/**
 * Carrega as respostas salvas antes de montar a tela, para o formulário
 * já nascer pré-preenchido (sem setState em efeito).
 */
export function WithAnswers({ children }: { children: (answers: OnboardingAnswers | null) => ReactNode }) {
  const userId = useUserId();
  const { data, isPending, isError, error, refetch } = useOnboardingAnswers(userId);
  if (isPending) return <LoadingView />;
  if (isError) return <ErrorView message={traduzir(error.message)} onRetry={() => refetch()} />;
  return <>{children(data ?? null)}</>;
}

/** Grava a etapa, atualiza o cache das respostas e vai para a próxima tela. */
export function useAdvance(step: OnboardingStep) {
  const userId = useUserId();
  const client = useQueryClient();

  return async (fields: Partial<Omit<OnboardingAnswers, 'current_step'>>) => {
    const next = nextOnboardingStep(step);
    await saveStep(userId, fields, next);
    client.setQueryData<OnboardingAnswers | null>(qk.onboarding(userId), (prev) => ({
      ...(prev ?? ({} as OnboardingAnswers)),
      ...fields,
      current_step: next,
    }));
    if (next !== 'completo') router.push(`/onboarding/${next}`);
  };
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 36 },
  segments: { flex: 1, flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 3, borderRadius: 2 },
});

// ─── Tela de escolha única ────────────────────────────────────────────────────

export type ChoiceOption = { value: string; label: string; emoji: string };

/**
 * Pergunta de uma resposta só (motivação, como conheceu, trava).
 * `optional`: deixa continuar sem escolher e grava `fallback`.
 */
export function SingleChoiceStep({
  step,
  title,
  subtitle,
  options,
  initial,
  field,
  optional = false,
  fallback,
}: {
  step: OnboardingStep;
  title: string;
  subtitle: string;
  options: ChoiceOption[];
  initial: string | null | undefined;
  field: 'motivacao' | 'objetivo' | 'trava';
  optional?: boolean;
  fallback?: string;
}) {
  const advance = useAdvance(step);
  const [selected, setSelected] = useState<string | null>(
    initial && options.some((o) => o.value === initial) ? initial : null,
  );

  return (
    <OnboardingShell
      step={step}
      canContinue={optional || selected !== null}
      onSubmit={() => advance({ [field]: selected ?? fallback ?? null })}
    >
      <CoachBubble title={title} subtitle={subtitle} />
      <View style={{ gap: spacing.sm }}>
        {options.map((o) => (
          <OptionRow
            key={o.value}
            label={o.label}
            emoji={o.emoji}
            selected={selected === o.value}
            onPress={() => setSelected(o.value)}
          />
        ))}
      </View>
    </OnboardingShell>
  );
}
