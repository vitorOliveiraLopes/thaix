import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, ErrorBox, Field } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { font, spacing, useTheme } from '@/theme';

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
    // Sem confirmação de e-mail, a sessão já existe e o app vai para a home.
  }

  if (sentTo) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]}>
        <View style={styles.container}>
          <Card>
            <Text style={[font.heading, { color: c.text }]}>Confira seu e-mail</Text>
            <Text style={[font.body, { color: c.muted }]}>
              Enviamos um link de confirmação para {sentTo}. Depois de confirmar, volte e entre com sua senha.
            </Text>
          </Card>
          <Link href="/login" style={[font.body, styles.footer, { color: c.primary, fontWeight: '700' }]}>
            Ir para o login
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.sm }}>
            <Text style={[font.caption, styles.eyebrow, { color: c.primary }]}>THAIXSKILL</Text>
            <Text style={[font.title, { color: c.text }]}>Crie sua conta</Text>
            <Text style={[font.body, { color: c.muted }]}>7 dias grátis para testar o método da Coach Thaís.</Text>
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

          <Text style={[font.body, styles.footer, { color: c.muted }]}>
            Já tem conta?{' '}
            <Link href="/login" style={{ color: c.primary, fontWeight: '700' }}>
              Entrar
            </Link>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xxl },
  eyebrow: { letterSpacing: 1.5 },
  footer: { textAlign: 'center', fontSize: 14 },
});
