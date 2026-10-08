import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { TimeField } from '@/components/inputs';
import { Button, Card, Divider, ErrorBox, ListRow, LoadingView, Screen, Txt } from '@/components/ui';
import { DEFAULT_NOTIFICATIONS, useAccount, useUserId, type NotificationSettings } from '@/lib/account';
import { useUpdateSettings } from '@/lib/settings';
import { spacing, useTheme } from '@/theme';

function NotificationsForm({ initial }: { initial: NotificationSettings }) {
  const c = useTheme();
  const userId = useUserId();
  const update = useUpdateSettings(userId);
  const [settings, setSettings] = useState(initial);

  const set = (key: keyof NotificationSettings, patch: Partial<NotificationSettings['workout']>) =>
    setSettings((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const rows: { key: keyof NotificationSettings; title: string; subtitle: string }[] = [
    { key: 'workout', title: 'Lembrete de treino', subtitle: 'Aviso nos seus dias de skill' },
    { key: 'hydration', title: 'Lembrete de hidratação', subtitle: 'Lembra de beber água e marcar a meta' },
  ];

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          {update.isError && <ErrorBox>Não foi possível salvar. Tente de novo.</ErrorBox>}
          <Button label="Salvar" loading={update.isPending} onPress={() => update.mutate({ notifications: settings }, { onSuccess: () => router.back() })} />
        </>
      }
    >
      <Card padded={false}>
        {rows.map((r, i) => (
          <View key={r.key}>
            {i > 0 && <Divider />}
            <ListRow
              title={r.title}
              subtitle={r.subtitle}
              right={
                <Switch
                  value={settings[r.key].enabled}
                  onValueChange={(v) => set(r.key, { enabled: v })}
                  trackColor={{ true: c.primary, false: c.border }}
                  accessibilityLabel={r.title}
                />
              }
            />
            {settings[r.key].enabled && (
              <ListRow title="Horário" right={<TimeField label={`Horário: ${r.title}`} value={settings[r.key].time} onChange={(t) => set(r.key, { time: t })} />} />
            )}
          </View>
        ))}
      </Card>
      <Txt variant="small" color="muted" center style={{ paddingHorizontal: spacing.lg }}>
        Os lembretes por notificação chegam numa próxima atualização do app. Seus horários já ficam salvos.
      </Txt>
    </Screen>
  );
}

export default function NotificacoesScreen() {
  const account = useAccount();
  if (account.isPending) return <LoadingView />;
  return <NotificationsForm initial={account.data?.settings?.notifications ?? DEFAULT_NOTIFICATIONS} />;
}
