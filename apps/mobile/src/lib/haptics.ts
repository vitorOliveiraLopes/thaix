import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Vibração curta de confirmação. Na web não existe: não faz nada.
const enabled = Platform.OS !== 'web';

export function selectionFeedback() {
  if (enabled) Haptics.selectionAsync().catch(() => {});
}

export function successFeedback() {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
