import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, Chip, Screen, Txt } from '@/components/ui';
import { useAccount } from '@/lib/account';
import { useAuth } from '@/lib/auth';
import { openWhatsApp } from '@/lib/settings';
import { font, spacing, useTheme } from '@/theme';

const FEATURES = {
  anual: ['Acesso completo a todos os treinos', 'Coach no chat', 'Cancele quando quiser'],
  mensal: ['Todos os treinos da Thaix', 'Vídeos de técnica', 'Suporte da equipe'],
};

/**
 * Oferta de planos. Aparece depois do onboarding e quando o trial vence.
 * Com o trial vencido não há "continuar sem assinar": só assinar, suporte ou sair.
 */
export default function PaywallScreen() {
  const c = useTheme();
  const { signOut } = useAuth();
  const account = useAccount();
  const expired = account.data?.trialExpired ?? false;
  const [plan, setPlan] = useState<'anual' | 'mensal'>('anual');

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        <>
          <Button
            label={plan === 'anual' ? (expired ? 'Assinar plano anual' : 'Começar 7 dias grátis') : 'Assinar plano mensal'}
            onPress={() => (expired || plan === 'mensal' ? openWhatsApp(`Olá! Quero assinar o plano ${plan} do ThaixSkill.`) : close())}
          />
          {expired ? (
            <View style={styles.row}>
              <Button label="Falar com o suporte" variant="ghost" size="sm" onPress={() => openWhatsApp()} style={{ flex: 1 }} />
              <Button label="Sair da conta" variant="ghost" size="sm" onPress={() => signOut()} style={{ flex: 1 }} />
            </View>
          ) : (
            <Button label="Continuar sem assinar" variant="ghost" onPress={close} />
          )}
        </>
      }
    >
      <View style={{ gap: spacing.xs, paddingTop: spacing.lg }}>
        <Txt variant="display">{expired ? 'Seu teste grátis acabou.' : 'Oferta especial.'}</Txt>
        <Txt color="muted">{expired ? 'Assine para continuar evoluindo nas suas skills.' : 'Cancele quando quiser.'}</Txt>
      </View>

      <View style={[styles.row, { backgroundColor: c.surfaceMuted, padding: 4, borderRadius: 14 }]}>
        <Chip flex label="Anual" selected={plan === 'anual'} onPress={() => setPlan('anual')} />
        <Chip flex label="Mensal" selected={plan === 'mensal'} onPress={() => setPlan('mensal')} />
      </View>

      <Card style={{ borderColor: c.primary, borderWidth: 2, gap: spacing.md }}>
        {plan === 'anual' ? (
          <>
            <Badge label="Escolha de 87% dos alunos" fg={c.onPrimary} bg={c.primary} />
            <Txt variant="small" color="muted" style={{ textDecorationLine: 'line-through' }}>
              R$ 59,90/mês
            </Txt>
            <Text style={[font.display, font.number, { color: c.primary }]}>
              R$ 16,40 <Text style={[font.subheading, { color: c.text }]}>/ mês</Text>
            </Text>
            <Txt variant="small" color="muted">
              Ou apenas R$ 0,54 por dia
            </Txt>
            <View style={styles.row}>
              <Badge label="Economize 72%" fg={c.onAccent} bg={c.accent} />
              {!expired && <Badge label="🎁 7 dias grátis" fg={c.text} bg={c.surfaceMuted} />}
            </View>
          </>
        ) : (
          <>
            <Text style={[font.display, font.number, { color: c.text }]}>
              R$ 59,90 <Text style={[font.subheading, { color: c.muted }]}>/ mês</Text>
            </Text>
            <Txt variant="small" color="muted">
              Renova automaticamente
            </Txt>
          </>
        )}
        {FEATURES[plan].map((f) => (
          <View key={f} style={styles.row}>
            <Ionicons name="checkmark-circle" size={18} color={c.success} />
            <Txt variant="small">{f}</Txt>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
