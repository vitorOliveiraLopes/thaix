import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { font, radius, spacing, useTheme } from '@/theme';

// ─── Horário (HH:MM) ──────────────────────────────────────────────────────────

function toDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 7, Number.isFinite(m) ? m : 30, 0, 0);
  return d;
}

function toHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Seletor de horário nativo: no iOS o botão compacto do sistema, no Android
 * o relógio em diálogo.
 */
export function TimeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const c = useTheme();

  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        accessibilityLabel={label}
        value={toDate(value)}
        mode="time"
        display="compact"
        locale="pt-BR"
        accentColor={c.primary}
        onChange={(_e: DateTimePickerEvent, d?: Date) => d && onChange(toHHMM(d))}
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={() =>
        DateTimePickerAndroid.open({
          value: toDate(value),
          mode: 'time',
          is24Hour: true,
          onChange: (e, d) => {
            if (e.type === 'set' && d) onChange(toHHMM(d));
          },
        })
      }
      style={[styles.timeButton, { backgroundColor: c.surfaceMuted }]}
    >
      <Text style={[font.heading, font.number, { color: c.primary }]}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  timeButton: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
});
