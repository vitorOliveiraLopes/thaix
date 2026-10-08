import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorBox, Field } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { font, spacing, useTheme } from '@/theme';

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
    // Em caso de sucesso, o Stack.Protected troca para a home sozinho.
    if (err) setError(err);
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.sm }}>
            <Text style={[font.caption, styles.eyebrow, { color: c.primary }]}>THAIXSKILL</Text>
            <Text style={[font.title, { color: c.text }]}>Bom te ver de novo</Text>
            <Text style={[font.body, { color: c.muted }]}>Entre para ver os treinos de hoje.</Text>
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
          </View>

          <Text style={[font.body, styles.footer, { color: c.muted }]}>
            Ainda não tem conta?{' '}
            <Link href="/signup" style={{ color: c.primary, fontWeight: '700' }}>
              Criar conta
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
