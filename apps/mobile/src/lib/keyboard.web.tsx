import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

// No navegador o próprio browser cuida do teclado (e a biblioteca nativa
// não existe na web): o provedor só repassa e a view é uma View comum.

export function KeyboardProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

type Props = ViewProps & { behavior?: string; automaticOffset?: boolean; keyboardVerticalOffset?: number; enabled?: boolean };

const KEYBOARD_PROPS = ['behavior', 'automaticOffset', 'keyboardVerticalOffset', 'enabled'] as const;

export function KeyboardAvoidingView(props: Props) {
  // Repassa só as props de View (as do teclado não existem no DOM).
  const rest = { ...props } as Record<string, unknown>;
  for (const k of KEYBOARD_PROPS) delete rest[k];
  return <View {...(rest as ViewProps)} />;
}
