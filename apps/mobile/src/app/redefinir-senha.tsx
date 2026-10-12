import { parseAuthCallback } from '@thaix/core';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button, Card, ErrorBox, Field, Screen, Txt } from '@/components/ui';
import { authErrorMessage, MIN_PASSWORD } from '@/lib/auth';
import { createIsolatedClient, supabase } from '@/lib/supabase';
import { spacing } from '@/theme';

/**
 * Nova senha a partir do link do e-mail (Android e web).
 *
 * A sessão de recuperação do link é usada num cliente avulso só para trocar a
 * senha; depois o app entra normalmente com a senha nova. Assim o app não
 * fica "logado pela metade" enquanto o aluno digita.
 */
export default function ResetPasswordScreen() {
  // Web: a URL da página (o link do e-mail). Android: o link que abriu o app.
  const nativeUrl = Linking.useURL();
  const [webUrl] = useState(() => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null));
  const link = useMemo(() => parseAuthCallback(webUrl ?? nativeUrl), [webUrl, nativeUrl]);

  // Tira o token da barra de endereço (histórico, prints, compartilhamento).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.location.hash) return;
    // Depois do primeiro render do roteador, que também mexe no histórico.
    const timer = setTimeout(() => window.history.replaceState(window.history.state, '', window.location.pathname), 0);
    return () => clearTimeout(timer);
  }, []);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (link.kind !== 'session') return;
    if (password.length < MIN_PASSWORD) return setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
    if (password !== confirm) return setError('As senhas não são iguais.');
    setError(null);
    setSaving(true);

    const recovery = createIsolatedClient();
    const { error: sessionError } = await recovery.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
    if (sessionError) {
      setSaving(false);
      return setError('Esse link expirou ou já foi usado. Peça um novo.');
    }
    const { data, error: updateError } = await recovery.auth.updateUser({ password });
    if (updateError || !data.user?.email) {
      setSaving(false);
      return setError(updateError ? authErrorMessage(updateError.message) : 'Não foi possível concluir. Tente de novo.');
    }

    // Entra com a senha nova; se falhar, a senha já mudou e o aluno entra pelo login.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.user.email, password });
    setSaving(false);
    if (signInError) setDone(true);
    else router.replace('/');
  }

  return (
    <Screen keyboard edges={['top', 'bottom']} contentStyle={styles.container}>
      <View style={{ gap: spacing.sm }}>
        <Txt variant="title">Nova senha</Txt>
        <Txt color="muted">Escolha a senha que você vai usar para entrar.</Txt>
      </View>

      {done ? (
        <Card>
          <Txt variant="heading">Senha alterada</Txt>
          <Txt color="muted">Agora é só entrar com a senha nova.</Txt>
        </Card>
      ) : link.kind === 'session' ? (
        <View style={{ gap: spacing.lg }}>
          <Field
            label={`Senha nova (mínimo ${MIN_PASSWORD} caracteres)`}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <Field
            label="Repita a senha"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          {error && <ErrorBox>{error}</ErrorBox>}
          <Button label="Salvar senha" onPress={handleSubmit} loading={saving} />
        </View>
      ) : (
        <Card>
          <Txt variant="heading">Link inválido</Txt>
          <Txt color="muted">
            {link.kind === 'error' ? link.message : 'Abra esta tela pelo link que enviamos para o seu e-mail.'}
          </Txt>
        </Card>
      )}

      {link.kind !== 'session' && !done && (
        <Button label="Pedir um link novo" variant="outline" onPress={() => router.replace('/esqueci-senha')} />
      )}
      <Button label="Ir para o login" variant="ghost" onPress={() => router.replace('/login')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },
});
