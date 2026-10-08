import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Chip, ErrorBox, LoadingView, Screen, SectionLabel, Txt } from '@/components/ui';
import { DEFAULT_PREFERENCES, useAccount, useUserId, type Preferences } from '@/lib/account';
import { useUpdateSettings } from '@/lib/settings';
import { spacing, useThemePreference } from '@/theme';

const THEMES: { value: Preferences['theme']; label: string }[] = [
  { value: 'light', label: '☀️ Claro' },
  { value: 'dark', label: '🌙 Escuro' },
  { value: 'system', label: '⚙️ Sistema' },
];

function PreferencesForm({ initial }: { initial: Preferences }) {
  const userId = useUserId();
  const update = useUpdateSettings(userId);
  const { setPreference } = useThemePreference();
  const [prefs, setPrefs] = useState(initial);

  // Cada toque já salva: o tema muda na hora e a escolha vai para a conta.
  function change(next: Preferences) {
    setPrefs(next);
    setPreference(next.theme);
    update.mutate({ preferences: next });
  }

  return (
    <Screen edges={['bottom']}>
      <Card>
        <SectionLabel>Tema</SectionLabel>
        <View style={styles.row}>
          {THEMES.map((t) => (
            <Chip key={t.value} flex label={t.label} selected={prefs.theme === t.value} onPress={() => change({ ...prefs, theme: t.value })} />
          ))}
        </View>
      </Card>
      <Card>
        <SectionLabel>Unidade de peso</SectionLabel>
        <View style={styles.row}>
          {(['kg', 'lb'] as const).map((u) => (
            <Chip key={u} flex label={u === 'kg' ? 'Quilogramas (kg)' : 'Libras (lb)'} selected={prefs.weightUnit === u} onPress={() => change({ ...prefs, weightUnit: u })} />
          ))}
        </View>
      </Card>
      {update.isError ? (
        <ErrorBox>Não foi possível salvar na sua conta. A mudança vale só neste aparelho por enquanto.</ErrorBox>
      ) : (
        <Txt variant="small" color="muted" center>
          As mudanças são salvas automaticamente.
        </Txt>
      )}
    </Screen>
  );
}

export default function PreferenciasScreen() {
  const account = useAccount();
  if (account.isPending) return <LoadingView />;
  return <PreferencesForm initial={account.data?.settings?.preferences ?? DEFAULT_PREFERENCES} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
});
