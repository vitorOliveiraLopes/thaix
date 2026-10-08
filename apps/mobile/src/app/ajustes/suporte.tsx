import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { View } from 'react-native';

import { Card, Divider, ListRow, Screen, Txt } from '@/components/ui';
import { openWhatsApp } from '@/lib/settings';
import { spacing } from '@/theme';

const WEB = (process.env.EXPO_PUBLIC_API_URL ?? 'https://thaix.vercel.app').replace(/\/+$/, '');

export default function SuporteScreen() {
  return (
    <Screen edges={['bottom']}>
      <Card padded={false}>
        <ListRow emoji="💬" title="Falar com o suporte" subtitle="Atendimento pelo WhatsApp" onPress={() => openWhatsApp('Olá! Preciso de ajuda com o app ThaixSkill.')} />
        <Divider />
        <ListRow icon="document-text-outline" title="Termos de uso" onPress={() => WebBrowser.openBrowserAsync(`${WEB}/termos`)} />
        <Divider />
        <ListRow icon="shield-checkmark-outline" title="Política de privacidade" onPress={() => WebBrowser.openBrowserAsync(`${WEB}/privacidade`)} />
      </Card>
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Txt variant="small" color="muted">
          ThaixSkill v{Constants.expoConfig?.version ?? '1.0.0'}
        </Txt>
        <Txt variant="small" color="muted">
          Feito com 💪 para atletas de verdade
        </Txt>
      </View>
    </Screen>
  );
}
