import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { forwardRef, memo, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, levelColors, radius, spacing, useTheme } from '@/theme';
import { LEVEL_LABELS, normalizeLevel } from '@thaix/core';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Toque leve de confirmação. Falhas (aparelho sem motor) são ignoradas. */
export function tapFeedback() {
  Haptics.selectionAsync().catch(() => {});
}

// ─── Texto ────────────────────────────────────────────────────────────────────

type TxtVariant = keyof typeof font;

export function Txt({
  variant = 'body',
  color,
  style,
  children,
  numberOfLines,
  center,
}: {
  variant?: TxtVariant;
  color?: 'text' | 'muted' | 'primary' | 'danger' | 'success' | 'onPrimary' | 'warning';
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  center?: boolean;
}) {
  const c = useTheme();
  const tone = color ? c[color] : c.text;
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[font[variant] as TextStyle, { color: tone }, center && { textAlign: 'center' }, style]}
    >
      {children}
    </Text>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionLabel}>
      <Txt variant="caption" color="muted" style={{ textTransform: 'uppercase' }}>
        {children}
      </Txt>
      {right}
    </View>
  );
}

// ─── Telas ────────────────────────────────────────────────────────────────────

/** Tela com rolagem, área segura e pull-to-refresh opcional. */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
  footer,
  edges = ['top'],
  contentStyle,
  keyboard = false,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  footer?: ReactNode;
  edges?: ('top' | 'bottom')[];
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
}) {
  const c = useTheme();
  const body = (
    <>
      <ScrollView
        contentContainerStyle={[styles.screenContent, contentStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} /> : undefined
        }
      >
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>{footer}</View> : null}
    </>
  );
  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: c.background }]}>
      {keyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior="padding" automaticOffset>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function LoadingView() {
  const c = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: c.background }]}>
      <ActivityIndicator color={c.primary} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: c.background, padding: spacing.xl, gap: spacing.lg }]}>
      <Txt center color="muted">
        {message}
      </Txt>
      {onRetry && <Button label="Tentar de novo" variant="outline" onPress={onRetry} />}
    </View>
  );
}

// ─── Botões ───────────────────────────────────────────────────────────────────

type ButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'dark';
  size?: 'md' | 'sm';
  icon?: IconName;
  iconRight?: IconName;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  style,
}: ButtonProps) {
  const c = useTheme();
  const inactive = disabled || loading;
  const palette = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary },
    dark: { bg: c.text, fg: c.background, border: c.text },
    outline: { bg: 'transparent', fg: c.text, border: c.border },
    ghost: { bg: 'transparent', fg: c.primary, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        { backgroundColor: palette.bg, borderColor: palette.border },
        (pressed || inactive) && { opacity: inactive ? 0.4 : 0.75 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={18} color={palette.fg} />}
          <Text style={[font.subheading, { color: palette.fg, fontSize: size === 'sm' ? 14 : 16 }]}>{label}</Text>
          {iconRight && <Ionicons name={iconRight} size={18} color={palette.fg} />}
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 22,
  color,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  color?: string;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icon} size={size} color={color ?? c.text} />
    </Pressable>
  );
}

// ─── Superfícies ──────────────────────────────────────────────────────────────

export function Card({
  children,
  style,
  onPress,
  tone = 'surface',
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  tone?: 'surface' | 'primarySoft' | 'warningSoft' | 'muted';
  padded?: boolean;
}) {
  const c = useTheme();
  const bg = { surface: c.surface, primarySoft: c.primarySoft, warningSoft: c.warningSoft, muted: c.surfaceMuted }[tone];
  const base = [styles.card, padded && styles.cardPadded, { backgroundColor: bg, borderColor: c.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: 0.8 }]}>
      {children}
    </Pressable>
  );
}

export function Divider() {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

/** Linha de lista com ícone, título, subtítulo e seta. */
export function ListRow({
  icon,
  emoji,
  title,
  subtitle,
  onPress,
  right,
  danger,
}: {
  icon?: IconName;
  emoji?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: c.surfaceMuted }]}
    >
      {(icon || emoji) && (
        <View style={[styles.rowIcon, { backgroundColor: c.surfaceMuted }]}>
          {emoji ? <Text style={{ fontSize: 18 }}>{emoji}</Text> : <Ionicons name={icon!} size={18} color={danger ? c.danger : c.muted} />}
        </View>
      )}
      <View style={styles.flex}>
        <Txt variant="subheading" color={danger ? 'danger' : 'text'}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="small" color="muted">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right !== undefined ? right : onPress ? <Ionicons name="chevron-forward" size={18} color={c.muted} /> : null}
    </Pressable>
  );
}

// ─── Indicadores ──────────────────────────────────────────────────────────────

export function ProgressBar({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const c = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: c.surfaceMuted, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height, backgroundColor: color ?? c.primary, borderRadius: height }} />
    </View>
  );
}

export function Badge({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[font.caption, { color: fg, letterSpacing: 0.3 }]}>{label}</Text>
    </View>
  );
}

export const LevelBadge = memo(function LevelBadge({ level }: { level: string }) {
  const c = useTheme();
  const norm = normalizeLevel(level);
  const { fg, bg } = levelColors(c, norm);
  return <Badge label={LEVEL_LABELS[norm]} fg={fg} bg={bg} />;
});

export function EmptyState({ emoji, title, message, action }: { emoji: string; title: string; message: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
      <Text style={{ fontSize: 32 }}>{emoji}</Text>
      <Txt variant="subheading" center>
        {title}
      </Txt>
      <Txt variant="small" color="muted" center>
        {message}
      </Txt>
      {action}
    </Card>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  const c = useTheme();
  return (
    <View accessibilityRole="alert" style={[styles.errorBox, { backgroundColor: c.dangerSoft }]}>
      <Txt variant="small" color="danger">
        {children}
      </Txt>
    </View>
  );
}

// ─── Entrada ──────────────────────────────────────────────────────────────────

type FieldProps = TextInputProps & { label: string };

export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, style, ...props }, ref) {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Txt variant="label" color="muted">
        {label}
      </Txt>
      <TextInput
        ref={ref}
        placeholderTextColor={c.muted}
        style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }, style]}
        {...props}
      />
    </View>
  );
});

/** Opção selecionável (uma ou várias), com ícone e marcação. */
export const OptionRow = memo(function OptionRow({
  label,
  sublabel,
  emoji,
  selected,
  onPress,
  multi = false,
}: {
  label: string;
  sublabel?: string;
  emoji?: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={[
        styles.option,
        { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primarySoft : c.surface },
      ]}
    >
      {emoji ? (
        <View style={[styles.optionIcon, { backgroundColor: selected ? c.primary : c.surfaceMuted }]}>
          <Text style={{ fontSize: 17 }}>{emoji}</Text>
        </View>
      ) : null}
      <View style={styles.flex}>
        <Txt variant="subheading">{label}</Txt>
        {sublabel ? (
          <Txt variant="small" color="muted">
            {sublabel}
          </Txt>
        ) : null}
      </View>
      {multi ? (
        <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={22} color={selected ? c.primary : c.border} />
      ) : selected ? (
        <Ionicons name="checkmark-circle" size={22} color={c.primary} />
      ) : null}
    </Pressable>
  );
});

/** Pílula selecionável compacta (dias da semana, minutos). */
export function Chip({ label, selected, onPress, flex }: { label: string; selected: boolean; onPress: () => void; flex?: boolean }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={[
        styles.chip,
        // Em linhas com muitos itens (7 dias da semana) a largura é pequena:
        // sem padding lateral o rótulo cabe inteiro.
        flex && [styles.flex, styles.chipCompact],
        { backgroundColor: selected ? c.primary : c.surfaceMuted, borderColor: selected ? c.primary : c.surfaceMuted },
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[font.label, { color: selected ? c.onPrimary : c.muted, textAlign: 'center' }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Folha inferior ───────────────────────────────────────────────────────────

export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <Pressable style={[styles.flex, { backgroundColor: c.overlay }]} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={[styles.grabber, { backgroundColor: c.border }]} />
          <View style={styles.sheetHeader}>
            <View style={styles.flex}>
              <Txt variant="heading">{title}</Txt>
              {subtitle ? (
                <Txt variant="small" color="muted">
                  {subtitle}
                </Txt>
              ) : null}
            </View>
            <IconButton icon="close" label="Fechar" onPress={onClose} color={c.muted} />
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Coach ────────────────────────────────────────────────────────────────────

export function CoachBubble({ title, subtitle }: { title: string; subtitle?: string }) {
  const c = useTheme();
  return (
    <View style={styles.coachRow}>
      <View style={[styles.coachAvatar, { backgroundColor: c.primary }]}>
        <Text style={[font.subheading, { color: c.onPrimary }]}>T</Text>
      </View>
      <View style={[styles.coachBubble, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Txt variant="subheading">{title}</Txt>
        {subtitle ? (
          <Txt variant="small" color="muted">
            {subtitle}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  screenContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.sm },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonSm: { minHeight: 40, paddingHorizontal: spacing.lg },
  iconButton: { padding: spacing.xs },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, overflow: 'hidden' },
  cardPadded: { padding: spacing.lg, gap: spacing.sm },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 3, alignSelf: 'flex-start' },
  errorBox: { borderRadius: radius.md, padding: spacing.md },
  input: { minHeight: 50, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  optionIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  chipCompact: { paddingHorizontal: 2, minWidth: 0 },
  chip: { minHeight: 42, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.lg, gap: spacing.lg },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: spacing.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  coachRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  coachAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  coachBubble: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, borderTopLeftRadius: 4, padding: spacing.md, gap: 2 },
});
