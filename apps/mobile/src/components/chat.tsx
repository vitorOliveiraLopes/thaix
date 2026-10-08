import { formatSetsTarget, parseRichText, skillIcon, skillName, type RichSpan, type WorkoutAttachment } from '@thaix/core';
import { router } from 'expo-router';
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import { Badge, Button, Divider, Txt } from '@/components/ui';
import { font, radius, spacing, useTheme } from '@/theme';

// ─── Texto com formatação leve ────────────────────────────────────────────────

function Spans({ spans }: { spans: RichSpan[] }) {
  return spans.map((s, i) =>
    s.bold ? (
      <Text key={i} style={styles.bold}>
        {s.text}
      </Text>
    ) : (
      s.text
    ),
  );
}

/**
 * Mensagem do coach com parágrafos, listas e negrito. Cada item de lista
 * fica numa linha com marcador alinhado, em vez de tudo numa frase só.
 */
export const RichText = memo(function RichText({ text, color }: { text: string; color: string }) {
  const blocks = useMemo(() => parseRichText(text), [text]);
  const base: TextStyle = { ...(font.body as TextStyle), color };
  return (
    <View style={styles.blocks}>
      {blocks.map((b, i) =>
        b.type === 'paragraph' ? (
          <Text key={i} style={base}>
            <Spans spans={b.spans} />
          </Text>
        ) : (
          <View key={i} style={styles.listItem}>
            <Text style={[base, styles.marker]}>{b.type === 'bullet' ? '•' : `${b.n}.`}</Text>
            <Text style={[base, styles.flex]}>
              <Spans spans={b.spans} />
            </Text>
          </View>
        ),
      )}
    </View>
  );
});

// ─── Card de treino ───────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = { mobilidade: 'Mobilidade', core: 'Core', forca: 'Força', skill: 'Skill' };

/** Treino de hoje como estava na hora da mensagem, com atalho para o treino atual. */
export const WorkoutAttachmentCard = memo(function WorkoutAttachmentCard({ workout }: { workout: WorkoutAttachment }) {
  const c = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.icon}>{skillIcon(workout.skill_id)}</Text>
        <View style={styles.flex}>
          <Txt variant="subheading">{skillName(workout.skill_id)}</Txt>
          <Txt variant="small" color="muted">
            {workout.items.length} exercícios · ~{workout.minutes} min · semana {workout.week_number}
          </Txt>
        </View>
        {workout.completed && <Badge label="Concluído" fg={c.success} bg={c.successSoft} />}
      </View>
      <Divider />
      {workout.items.map((item, i) => (
        <View key={`${item.name}-${i}`} style={styles.exercise}>
          <View style={[styles.index, { backgroundColor: c.primarySoft }]}>
            <Txt variant="label" color="primary" style={font.number}>
              {i + 1}
            </Txt>
          </View>
          <View style={styles.flex}>
            <Txt variant="label">{item.name}</Txt>
            <Txt variant="small" color="muted">
              {CATEGORY_LABEL[item.category] ?? item.category}
            </Txt>
          </View>
          <Txt variant="label" style={font.number}>
            {formatSetsTarget(item)}
          </Txt>
        </View>
      ))}
      {!workout.completed && (
        <View style={styles.cardFooter}>
          <Button label="Abrir treino" size="sm" iconRight="chevron-forward" variant="outline" onPress={() => router.push(`/treino/${workout.workout_id}`)} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  blocks: { gap: spacing.xs },
  listItem: { flexDirection: 'row', gap: spacing.xs },
  marker: { minWidth: 16 },
  card: { width: '90%', alignSelf: 'flex-start', borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  icon: { fontSize: 22 },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  index: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardFooter: { padding: spacing.md, paddingTop: spacing.xs },
});
