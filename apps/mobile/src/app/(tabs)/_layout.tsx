import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import type { IconName } from '@/components/ui';
import { useTheme } from '@/theme';

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Início', icon: 'home-outline', iconActive: 'home' },
  { name: 'desempenho', title: 'Desempenho', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  { name: 'tecnicas', title: 'Técnicas', icon: 'play-circle-outline', iconActive: 'play-circle' },
  { name: 'chat', title: 'Coach', icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses' },
  { name: 'perfil', title: 'Perfil', icon: 'person-outline', iconActive: 'person' },
];

/**
 * Web: a altura padrão da barra (49px) não cabe ícone + nome com a fonte do
 * navegador, e o nome cortava embaixo. No celular fica a altura nativa.
 */
const WEB_TAB_BAR = { height: 68, paddingTop: 6, paddingBottom: 10 } as const;

export default function TabsLayout() {
  const c = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: [{ backgroundColor: c.background, borderTopColor: c.border }, Platform.OS === 'web' && WEB_TAB_BAR],
        // Web: fonte do navegador é mais larga; 10px faz "Desempenho" caber no celular.
        tabBarLabelStyle: { fontSize: Platform.OS === 'web' ? 10 : 11, lineHeight: 16, fontWeight: '600' },
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? t.iconActive : t.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
