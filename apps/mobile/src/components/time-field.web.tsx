import { createElement } from 'react';

import { font, radius, spacing, useTheme } from '@/theme';

/** Web: o seletor de horário do próprio navegador (o nativo não existe aqui). */
export function TimeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const c = useTheme();
  return createElement('input', {
    type: 'time',
    value,
    'aria-label': label,
    onChange: (e: { target: { value: string } }) => e.target.value && onChange(e.target.value),
    style: {
      ...font.heading,
      fontVariantNumeric: 'tabular-nums',
      color: c.primary,
      backgroundColor: c.surfaceMuted,
      border: 'none',
      borderRadius: radius.md,
      padding: `${spacing.xs}px ${spacing.md}px`,
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      colorScheme: 'light dark',
    },
  });
}
