import Slider from '@react-native-community/slider';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tapFeedback, Txt } from '@/components/ui';
import { font, radius, spacing, useTheme } from '@/theme';

export { TimeField } from './time-field';

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
  sliderCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  sliderTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  step: { alignItems: 'center', justifyContent: 'center' },
});
