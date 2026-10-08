import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, ErrorBox, Field, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { spacing } from '@/theme';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) {
      setError('Informe o e-mail da sua conta.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: err } = await resetPassword(email);
    setSubmitting(false);
    if (err) setError(err);
    else setSent(true);
  }

  return (
    <Screen keyboard edges={['top', 'bottom']} contentStyle={styles.container}>
      <View style={{ gap: spacing.sm }}>
        <Txt variant="title">Recuperar senha</Txt>
        <Txt color="muted">Enviamos um link para você criar uma senha nova.</Txt>
      </View>

      {sent ? (
        <Card>
          <Txt variant="heading">Link enviado</Txt>
          <Txt color="muted">Abra o e-mail que mandamos para {email.trim()} e siga as instruções. Depois volte e entre com a senha nova.</Txt>
        </Card>
      ) : (
        <View style={{ gap: spacing.lg }}>
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="send"
            onSubmitEditing={handleSubmit}
          />
          {error && <ErrorBox>{error}</ErrorBox>}
          <Button label="Enviar link" onPress={handleSubmit} loading={submitting} />
        </View>
      )}

      <Button label="Voltar para o login" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },
});
