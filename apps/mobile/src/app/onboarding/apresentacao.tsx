import { StyleSheet, Text, View } from 'react-native';

import { OnboardingShell, useAdvance } from '@/components/onboarding';
import { Card, Txt } from '@/components/ui';
import { font, spacing, useTheme } from '@/theme';

export default function Apresentacao() {
  const c = useTheme();
  const advance = useAdvance('apresentacao');

  return (
    <OnboardingShell step="apresentacao" onSubmit={() => advance({})}>
      <View style={styles.hero}>
        <View style={[styles.avatar, { backgroundColor: c.primarySoft, borderColor: c.primary }]}>
          <Text style={[font.display, { color: c.primary }]}>T</Text>
        </View>
        <Txt variant="title" center>
          Oi, eu sou a Thaix.
        </Txt>
      </View>

      <Card style={{ gap: spacing.md }}>
        <Txt>
          Eu treino e ensino CrossFit há anos e crio conteúdo focado no que ninguém quer filmar:{' '}
          <Txt variant="subheading">os progressivos básicos</Txt> que destravam os skills.
        </Txt>
        <Txt>
          Atendo dezenas de alunas por consultoria toda semana e a queixa é sempre a mesma:{' '}
          <Txt color="primary" style={{ fontStyle: 'italic' }}>
            “travei no pull-up”, “não consigo o toes-to-bar”, “muscle-up parece impossível”.
          </Txt>{' '}
          O problema quase nunca é força. É técnica que não foi ensinada.
        </Txt>
        <Txt>
          Aqui no app eu te entrego o método completo: mobilidade específica, força específica, educativos do zero e
          progressões em camadas. Para você fazer entre as aulas da sua box.
        </Txt>
      </Card>

      <View style={{ alignItems: 'center', gap: 2 }}>
        <Txt variant="heading" color="primary" style={{ fontStyle: 'italic' }}>
          Thaix
        </Txt>
        <Txt variant="caption" color="muted">
          THAIXSKILL
        </Txt>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.md },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
