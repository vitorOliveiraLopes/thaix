import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { tapFeedback, Txt } from '@/components/ui';
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

// ─── Número com slider e +/− ──────────────────────────────────────────────────

export function NumberSlider({
  value,
  onChange,
  min = 0,
  max,
  emoji,
  label,
  hint,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max: number;
  emoji: string;
  label: string;
  hint?: string;
}) {
  const c = useTheme();
  const set = (v: number) => {
    const next = Math.max(min, Math.min(max, Math.round(v)));
    if (next !== value) {
      tapFeedback();
      onChange(next);
    }
  };

  return (
    <View style={[styles.sliderCard, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.sliderTop}>
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Txt variant="subheading">{label}</Txt>
          {hint ? (
            <Txt variant="small" color="muted">
              {hint}
            </Txt>
          ) : null}
        </View>
        <Text style={[font.display, font.number, { color: c.primary, minWidth: 48, textAlign: 'right' }]}>{value}</Text>
      </View>
      <View style={styles.sliderRow}>
        <StepButton label="−" onPress={() => set(value - 1)} accessibilityLabel={`Diminuir ${label}`} />
        <Slider
          style={{ flex: 1, height: 40 }}
          minimumValue={min}
          maximumValue={max}
          step={1}
          value={value}
          onValueChange={set}
          minimumTrackTintColor={c.primary}
          maximumTrackTintColor={c.border}
          thumbTintColor={c.primary}
          accessibilityLabel={label}
        />
        <StepButton label="+" onPress={() => set(value + 1)} accessibilityLabel={`Aumentar ${label}`} />
      </View>
    </View>
  );
}

export function StepButton({
  label,
  onPress,
  accessibilityLabel,
  size = 36,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceMuted },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[font.heading, { color: c.text, lineHeight: 22 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  timeButton: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  sliderCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  sliderTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  step: { alignItems: 'center', justifyContent: 'center' },
});
