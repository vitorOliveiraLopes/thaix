import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import type { IconName } from '@/components/ui';
import { useTheme } from '@/theme';

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Início', icon: 'home-outline', iconActive: 'home' },
  { name: 'desempenho', title: 'Desempenho', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  { name: 'tecnicas', title: 'Técnicas', icon: 'play-circle-outline', iconActive: 'play-circle' },
  { name: 'chat', title: 'Coach', icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses' },
  { name: 'perfil', title: 'Perfil', icon: 'person-outline', iconActive: 'person' },
];

export default function TabsLayout() {
  const c = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.background, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
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
