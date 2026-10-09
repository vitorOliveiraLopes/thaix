import { Ionicons } from '@expo/vector-icons';
import { activeSetIndex, adjustSet, formatClock, setValueAt, type SetValues } from '@thaix/core';
import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StepButton } from '@/components/inputs';
import { Button, Card, ProgressBar, Txt, tapFeedback } from '@/components/ui';
import { font, radius, spacing, useTheme } from '@/theme';
import { successFeedback } from '@/lib/haptics';

// ─── Repetições por série ─────────────────────────────────────────────────────
//
// Uma linha por série, sem meta numérica visível. Séries preenchidas
// continuam com +/− ativos. A série ativa é a primeira vazia; as seguintes
// ficam esmaecidas até chegar a vez delas.

export const RepsSets = memo(function RepsSets({ values, onChange }: { values: SetValues; onChange: (v: SetValues) => void }) {
  const c = useTheme();
  const active = activeSetIndex(values);
  const anyFilled = values.some((v) => v !== null);

  return (
    <Card>
      <Txt variant="subheading">Quantas reps você fez?</Txt>
      <View style={{ gap: spacing.sm }}>
        {values.map((value, i) => {
          const filled = value !== null;
          const isActive = i === active;
          if (!filled && !isActive) {
            return (
              <View key={i} style={[styles.setRow, { borderColor: c.border, opacity: 0.45 }]}>
                <Txt variant="label">Série {i + 1}</Txt>
                <Txt variant="small" color="muted">
                  aguardando
                </Txt>
              </View>
            );
          }
          return (
            <View
              key={i}
              style={[
                styles.setRow,
                filled
                  ? { borderColor: c.border, backgroundColor: c.successSoft }
                  : { borderColor: c.primary, borderWidth: 2 },
              ]}
            >
              <Txt variant="label">Série {i + 1}</Txt>
              <View style={styles.row}>
                <StepButton label="−" size={34} accessibilityLabel={`Menos uma rep na série ${i + 1}`} onPress={() => { tapFeedback(); onChange(adjustSet(values, i, -1)); }} />
                <Text style={[font.heading, font.number, styles.count, { color: c.text }]}>{value ?? 0}</Text>
                <StepButton label="+" size={34} accessibilityLabel={`Mais uma rep na série ${i + 1}`} onPress={() => { tapFeedback(); onChange(adjustSet(values, i, 1)); }} />
                <Ionicons name="checkmark-circle" size={20} color={filled ? c.success : 'transparent'} />
              </View>
            </View>
          );
        })}
      </View>
      {!anyFilled && (
        <Txt variant="small" color="muted" center>
          Toque + para começar a registrar a série 1
        </Txt>
      )}
    </Card>
  );
});

// ─── Tempo por série ──────────────────────────────────────────────────────────
//
// O cronômetro mede pelo relógio do aparelho (não por contagem de ticks),
// então continua certo se a tela apagar ou o app for para segundo plano.
// Qualquer série registrada pode ser refeita tocando nela.

export function TimedSets({
  targetSec,
  values,
  onChange,
}: {
  targetSec: number;
  values: SetValues;
  onChange: (v: SetValues) => void;
}) {
  const c = useTheme();
  const [editing, setEditing] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  const firstEmpty = activeSetIndex(values);
  const active = editing ?? (firstEmpty === -1 ? values.length - 1 : firstEmpty);
  const running = startedAt !== null;

  // Refs com o estado atual, para o callback do intervalo não ficar defasado.
  const latest = useRef({ values, active, onChange, targetSec });
  useEffect(() => {
    latest.current = { values, active, onChange, targetSec };
  });

  function clear() {
    if (interval.current) clearInterval(interval.current);
    interval.current = null;
  }

  function commit(sec: number) {
    clear();
    const { values: v, active: a, onChange: change } = latest.current;
    change(setValueAt(v, a, sec));
    setStartedAt(null);
    setElapsed(0);
    setEditing(null);
  }

  function start() {
    tapFeedback();
    const t0 = Date.now();
    setStartedAt(t0);
    setElapsed(0);
    interval.current = setInterval(() => {
      const sec = Math.floor((Date.now() - t0) / 1000);
      setElapsed(sec);
      if (sec >= latest.current.targetSec) {
        successFeedback();
        commit(latest.current.targetSec);
      }
    }, 250);
  }

  function stop() {
    if (startedAt === null) return;
    commit(Math.floor((Date.now() - startedAt) / 1000));
  }

  function redo(i: number) {
    if (running) return;
    tapFeedback();
    setEditing(i);
  }

  useEffect(() => clear, []);

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <Txt variant="subheading">Séries</Txt>
        <View style={{ gap: spacing.sm }}>
          {values.map((value, i) => {
            const filled = value !== null;
            const isActive = i === active;
            if (!filled && !isActive) {
              return (
                <View key={i} style={[styles.setRow, { borderColor: c.border, opacity: 0.45 }]}>
                  <Txt variant="label">Série {i + 1}</Txt>
                  <Txt variant="small" color="muted">
                    aguardando
                  </Txt>
                </View>
              );
            }
            if (filled && !isActive) {
              return (
                <Pressable
                  key={i}
                  onPress={() => redo(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Refazer série ${i + 1}, ${value} segundos`}
                  style={[styles.setRow, { borderColor: c.border, backgroundColor: c.successSoft }]}
                >
                  <Txt variant="label">Série {i + 1}</Txt>
                  <View style={styles.row}>
                    <Text style={[font.subheading, font.number, { color: c.text }]}>{value}s</Text>
                    <Ionicons name="checkmark-circle" size={18} color={c.success} />
                    <Ionicons name="pencil" size={13} color={c.muted} />
                  </View>
                </Pressable>
              );
            }
            return (
              <View key={i} style={[styles.setRow, { borderColor: c.primary, borderWidth: 2 }]}>
                <Txt variant="label">Série {i + 1}</Txt>
                {filled && (
                  <Txt variant="small" color="muted">
                    refazendo
                  </Txt>
                )}
              </View>
            );
          })}
        </View>
      </Card>

      <View style={[styles.timer, { backgroundColor: c.text }]}>
        <Text style={[font.display, font.number, { color: c.background, fontSize: 48 }]}>
          {formatClock(elapsed)}
          <Text style={{ fontSize: 22, opacity: 0.45 }}> / {formatClock(targetSec)}</Text>
        </Text>
        <View style={{ alignSelf: 'stretch' }}>
          <ProgressBar value={elapsed / targetSec} color={c.primary} />
        </View>
        {running ? (
          <Button label="Parar e registrar" variant="outline" onPress={stop} style={{ alignSelf: 'stretch', borderColor: c.muted }} />
        ) : (
          <Button label={`Iniciar série ${active + 1}`} icon="play" onPress={start} style={{ alignSelf: 'stretch' }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  count: { minWidth: 28, textAlign: 'center' },
  timer: { borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.lg },
});
