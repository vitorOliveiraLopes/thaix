import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { font, radius, spacing, useTheme } from '@/theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
};

export function Button({ label, onPress, loading, disabled, variant = 'primary' }: ButtonProps) {
  const c = useTheme();
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        isPrimary
          ? { backgroundColor: c.primary }
          : { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
        (pressed || inactive) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? c.onPrimary : c.text} />
      ) : (
        <Text style={[font.heading, { color: isPrimary ? c.onPrimary : c.text, fontSize: 16 }]}>{label}</Text>
      )}
    </Pressable>
  );
}

type FieldProps = TextInputProps & { label: string };

export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, style, ...props }, ref) {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[font.label, { color: c.muted }]}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={c.muted}
        style={[
          styles.input,
          { backgroundColor: c.surface, borderColor: c.border, color: c.text },
          style,
        ]}
        {...props}
      />
    </View>
  );
});

export function ErrorBox({ children }: { children: ReactNode }) {
  const c = useTheme();
  return (
    <View accessibilityRole="alert" style={[styles.error, { backgroundColor: c.dangerSoft }]}>
      <Text style={[font.body, { color: c.danger, fontSize: 14 }]}>{children}</Text>
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const c = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
  },
  error: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
