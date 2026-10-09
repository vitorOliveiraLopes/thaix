import { Alert, Platform } from 'react-native';

/**
 * Pergunta de confirmação com Cancelar/Confirmar. No celular, o alerta do
 * sistema; na web (onde o Alert do React Native não aparece), o confirm do
 * navegador.
 */
export function confirmAction(opts: { title: string; message: string; confirmText: string; cancelText?: string; destructive?: boolean }): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${opts.title}\n\n${opts.message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      opts.title,
      opts.message,
      [
        { text: opts.cancelText ?? 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: opts.confirmText, style: opts.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
