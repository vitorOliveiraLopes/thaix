import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, ErrorBox, Field, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { spacing, useTheme } from '@/theme';

const MIN_PASSWORD = 6;

export default function SignupScreen() {
  const c = useTheme();
  const { signUp } = useAuth();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit() {
    if (submitting) return;
    if (!name.trim() || !email.trim() || !password) {
      setError('Preencha nome, e-mail e senha.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await signUp(name, email, password);
    setSubmitting(false);

    if (result.error) setError(result.error);
    else if (result.needsConfirmation) setSentTo(email.trim());
    // Sem confirmação de e-mail a sessão já existe e o onboarding abre sozinho.
  }

  if (sentTo) {
    return (
      <Screen edges={['top', 'bottom']} contentStyle={styles.container}>
        <Card>
          <Txt variant="heading">Confira seu e-mail</Txt>
          <Txt color="muted">
            Enviamos um link de confirmação para {sentTo}. Depois de confirmar, volte e entre com sua senha.
          </Txt>
        </Card>
        <Link href="/login" style={[styles.link, { color: c.primary }]}>
          Ir para o login
        </Link>
      </Screen>
    );
  }

  return (
    <Screen keyboard edges={['top', 'bottom']} contentStyle={styles.container}>
      <View style={{ gap: spacing.sm }}>
        <Txt variant="caption" color="primary">
          THAIXSKILL
        </Txt>
        <Txt variant="title">Crie sua conta</Txt>
        <Txt color="muted">7 dias grátis para testar o método da Coach Thaís.</Txt>
      </View>

      <View style={{ gap: spacing.lg }}>
        <Field
          label="Nome"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <Field
          ref={emailRef}
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
          label={`Senha (mínimo ${MIN_PASSWORD} caracteres)`}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
        {error && <ErrorBox>{error}</ErrorBox>}
        <Button label="Criar conta" onPress={handleSubmit} loading={submitting} />
      </View>

      <Txt variant="small" color="muted" center>
        Já tem conta?{' '}
        <Link href="/login" style={{ color: c.primary, fontWeight: '700' }}>
          Entrar
        </Link>
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xxl },
  link: { textAlign: 'center', fontSize: 15, fontWeight: '700' },
});
