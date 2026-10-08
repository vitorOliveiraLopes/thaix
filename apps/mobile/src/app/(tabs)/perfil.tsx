import { Ionicons } from '@expo/vector-icons';
import { trialDaysLeft } from '@thaix/core';
import { router } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, Divider, ListRow, Screen, Txt } from '@/components/ui';
import { useAccount } from '@/lib/account';
import { useAuth } from '@/lib/auth';
import { spacing, useTheme } from '@/theme';

export default function PerfilScreen() {
  const c = useTheme();
  const { signOut } = useAuth();
  const account = useAccount();
  const a = account.data;
  const status = a?.settings?.subscription_status;
  const days = trialDaysLeft(a?.settings?.trial_ends_at ?? null);

  const statusBadge =
    status === 'active'
      ? { label: 'Ativo', fg: c.success, bg: c.successSoft }
      : status === 'trial'
        ? { label: 'Trial gratuito', fg: c.primary, bg: c.primarySoft }
        : status === 'cancelled'
          ? { label: 'Cancelado', fg: c.danger, bg: c.dangerSoft }
          : { label: 'Sem plano', fg: c.muted, bg: c.surfaceMuted };

  function confirmSignOut() {
    Alert.alert('Sair da conta?', 'Você vai precisar entrar de novo com e-mail e senha.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <Screen onRefresh={() => account.refetch()} refreshing={account.isRefetching}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: c.primarySoft }]}>
          <Ionicons name="person" size={30} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="heading">{a?.profile.name ?? 'Atleta'}</Txt>
          <Txt variant="small" color="muted">
            {a?.email}
          </Txt>
        </View>
      </View>

      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <Ionicons name="diamond-outline" size={16} color={c.text} />
            <Txt variant="subheading">Minha assinatura</Txt>
          </View>
          <Badge {...statusBadge} />
        </View>
        {status === 'trial' && days !== null && (
          <Txt variant="small" color="muted">
            {days > 0 ? `${days} ${days === 1 ? 'dia restante' : 'dias restantes'} no trial` : 'Trial encerrado'}
          </Txt>
        )}
        {status === 'active' && a?.settings?.subscription_plan && (
          <Txt variant="small" color="muted">
            Plano {a.settings.subscription_plan}
          </Txt>
        )}
        <Button
          label={status === 'active' ? 'Gerenciar assinatura' : 'Ver planos'}
          variant="outline"
          size="sm"
          onPress={() => router.push('/ajustes/assinatura')}
        />
      </Card>

      <Card padded={false}>
        <ListRow icon="calendar-outline" title="Minha rotina" subtitle="Dias, tempo por sessão e equipamento" onPress={() => router.push('/ajustes/rotina')} />
        <Divider />
        <ListRow icon="notifications-outline" title="Notificações" onPress={() => router.push('/ajustes/notificacoes')} />
        <Divider />
        <ListRow icon="settings-outline" title="Preferências" onPress={() => router.push('/ajustes/preferencias')} />
        <Divider />
        <ListRow icon="help-circle-outline" title="Ajuda e suporte" onPress={() => router.push('/ajustes/suporte')} />
      </Card>

      <Card padded={false}>
        <ListRow icon="log-out-outline" title="Sair da conta" danger onPress={confirmSignOut} right={null} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
