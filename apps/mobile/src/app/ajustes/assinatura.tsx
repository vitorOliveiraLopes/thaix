import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, Screen, Txt } from '@/components/ui';
import { openWhatsApp } from '@/lib/settings';
import { font, spacing, useTheme } from '@/theme';

const PLANS = [
  { id: 'mensal', name: 'Mensal', price: 'R$ 59,90', period: '/mês', description: 'Flexibilidade total', highlight: false },
  { id: 'trimestral', name: 'Trimestral', price: 'R$ 39,90', period: '/mês', description: 'Cobrado R$ 119,70 a cada 3 meses', highlight: false },
  { id: 'anual', name: 'Anual', price: 'R$ 16,40', period: '/mês', description: 'Cobrado R$ 197,00 por ano · economia de 72%', highlight: true },
] as const;

const FEATURES = ['Acesso completo', 'Todos os treinos', 'Vídeos de técnica', 'Coach no chat'];

export default function AssinaturaScreen() {
  const c = useTheme();
  return (
    <Screen edges={['bottom']}>
      {PLANS.map((p) => (
        <Card key={p.id} style={p.highlight ? { borderColor: c.primary, borderWidth: 2 } : undefined}>
          {p.highlight && <Badge label="Escolha de 87% dos alunos" fg={c.onPrimary} bg={c.primary} />}
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Txt variant="heading">{p.name}</Txt>
              <Txt variant="small" color="muted">
                {p.description}
              </Txt>
            </View>
            <Text style={[font.heading, font.number, { color: c.text }]}>
              {p.price}
              <Text style={[font.small, { color: c.muted }]}>{p.period}</Text>
            </Text>
          </View>
          {FEATURES.map((f) => (
            <View key={f} style={styles.row}>
              <Ionicons name="checkmark" size={16} color={c.success} />
              <Txt variant="small">{f}</Txt>
            </View>
          ))}
          <Button
            label={`Assinar plano ${p.name.toLowerCase()}`}
            variant={p.highlight ? 'primary' : 'outline'}
            size="sm"
            onPress={() => openWhatsApp(`Olá! Quero assinar o plano ${p.id} do ThaixSkill.`)}
          />
        </Card>
      ))}
      <Txt variant="small" color="muted" center>
        Cancele quando quiser · sem taxas ocultas. A assinatura dentro do app chega em breve.
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
});
