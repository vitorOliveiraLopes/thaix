import { WEEKDAY_SHORT, isoFor, linearTrend, monthGrid, toLocalISODate } from '@thaix/core';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Txt } from '@/components/ui';
import { font, spacing, useTheme } from '@/theme';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function effortEmoji(score: number) {
  if (score <= 2) return '😄';
  if (score <= 4) return '😐';
  if (score <= 6) return '😕';
  return '😣';
}

/** Calendário do mês: dia com treino preenchido, ponto azul = água, emoji = esforço do dia. */
export const MonthCalendar = memo(function MonthCalendar({
  year,
  month,
  workoutDates,
  hydrationDates,
  efforts,
}: {
  year: number;
  month: number;
  workoutDates: Set<string>;
  hydrationDates: Set<string>;
  efforts: Map<string, number>;
}) {
  const c = useTheme();
  const today = toLocalISODate();
  const cells = useMemo(() => monthGrid(year, month), [year, month]);

  return (
    <View style={{ gap: spacing.sm }}>
      <Txt variant="subheading">
        {MONTHS[month]} {year}
      </Txt>
      <View style={styles.grid}>
        {WEEKDAY_SHORT.map((d) => (
          <View key={d} style={styles.cell}>
            <Txt variant="small" color="muted">
              {d[0]}
            </Txt>
          </View>
        ))}
        {cells.map((day, i) => {
          if (!day) return <View key={`e${i}`} style={styles.cell} />;
          const iso = isoFor(year, month, day);
          const trained = workoutDates.has(iso);
          const effort = efforts.get(iso);
          return (
            <View key={iso} style={styles.cell}>
              <View
                style={[
                  styles.day,
                  trained && { backgroundColor: c.primary },
                  !trained && iso === today && { borderWidth: 2, borderColor: c.primary },
                ]}
              >
                <Text style={[font.label, font.number, { color: trained ? c.onPrimary : c.text, fontSize: 12 }]}>{day}</Text>
              </View>
              <View style={styles.marks}>
                {hydrationDates.has(iso) && <View style={[styles.dot, { backgroundColor: c.info }]} />}
                {effort !== undefined && <Text style={{ fontSize: 8 }}>{effortEmoji(effort)}</Text>}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
});

/** Linha do esforço diário (0 a 10) dos últimos 30 registros, com a média tracejada. */
export function EffortChart({ logs }: { logs: { date: string; score: number }[] }) {
  const c = useTheme();
  const [width, setWidth] = useState(0);
  const last = logs.slice(-30);

  if (last.length === 0) {
    return (
      <Txt variant="small" color="muted" center style={{ paddingVertical: spacing.xl }}>
        Nenhum registro de esforço ainda. Registre pelo card “Esforço” na tela inicial.
      </Txt>
    );
  }

  const scores = last.map((l) => l.score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const trend = linearTrend(scores).direction;

  const H = 150;
  const pad = { l: 22, r: 8, t: 8, b: 20 };
  const plotW = Math.max(0, width - pad.l - pad.r);
  const plotH = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (last.length === 1 ? plotW / 2 : (i / (last.length - 1)) * plotW);
  const y = (v: number) => pad.t + plotH - (v / 10) * plotH;
  const fmt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.chartHead}>
        <Txt variant="small" color="muted">
          Média: <Txt variant="label">{avg.toFixed(1)}/10</Txt>
        </Txt>
        <Txt variant="label" color={trend === 'down' ? 'success' : trend === 'up' ? 'warning' : 'muted'}>
          {trend === 'down' ? '↓ Esforço caindo' : trend === 'up' ? '↑ Atenção' : '→ Estável'}
        </Txt>
      </View>
      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ height: H }}>
        {width > 0 && (
          <Svg width={width} height={H}>
            {[0, 5, 10].map((v) => (
              <Line key={v} x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke={c.border} strokeWidth={1} />
            ))}
            {[0, 5, 10].map((v) => (
              <SvgText key={`l${v}`} x={pad.l - 6} y={y(v) + 4} fontSize={10} fill={c.muted} textAnchor="end">
                {v}
              </SvgText>
            ))}
            <Line x1={pad.l} x2={width - pad.r} y1={y(avg)} y2={y(avg)} stroke={c.muted} strokeDasharray="4 4" strokeWidth={1} />
            <Polyline
              points={last.map((l, i) => `${x(i)},${y(l.score)}`).join(' ')}
              fill="none"
              stroke={c.primary}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {last.map((l, i) => (
              <Circle key={l.date} cx={x(i)} cy={y(l.score)} r={i === last.length - 1 ? 4.5 : 3} fill={c.primary} />
            ))}
            <SvgText x={pad.l} y={H - 4} fontSize={10} fill={c.muted}>
              {fmt(last[0].date)}
            </SvgText>
            {last.length > 1 && (
              <SvgText x={width - pad.r} y={H - 4} fontSize={10} fill={c.muted} textAnchor="end">
                {fmt(last[last.length - 1].date)}
              </SvgText>
            )}
          </Svg>
        )}
      </View>
      <Txt variant="small" color="muted" center>
        Últimos {last.length} registros · tracejado = média
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3, gap: 2 },
  day: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  marks: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 9 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
