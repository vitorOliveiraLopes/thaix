import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, ErrorBox, Field, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { spacing, useTheme } from '@/theme';

export default function LoginScreen() {
  const c = useTheme();
  const { signIn } = useAuth();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting) return;
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: err } = await signIn(email, password);
    setSubmitting(false);
    // Em caso de sucesso, os guards do layout trocam de tela sozinhos.
    if (err) setError(err);
  }

  return (
    <Screen keyboard edges={['top', 'bottom']} contentStyle={styles.container}>
      <View style={{ gap: spacing.sm }}>
        <Txt variant="caption" color="primary">
          THAIXSKILL
        </Txt>
        <Txt variant="title">Bom te ver de novo</Txt>
        <Txt color="muted">Entre para ver os treinos de hoje.</Txt>
      </View>

      <View style={{ gap: spacing.lg }}>
        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <Field
          ref={passwordRef}
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
        {error && <ErrorBox>{error}</ErrorBox>}
        <Button label="Entrar" onPress={handleSubmit} loading={submitting} />
        <Link href="/esqueci-senha" style={[styles.link, { color: c.muted }]}>
          Esqueci minha senha
        </Link>
      </View>

      <Txt variant="small" color="muted" center>
        Ainda não tem conta?{' '}
        <Link href="/signup" style={{ color: c.primary, fontWeight: '700' }}>
          Criar conta
        </Link>
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xxl },
  link: { textAlign: 'center', fontSize: 14, fontWeight: '600' },
});
