import { useColorScheme } from 'react-native';

/** Paleta da marca: Magenta, Volt, Ink e Bone. */
const brand = {
  magenta: '#FF2EA4',
  magentaDeep: '#D4127F',
  volt: '#C8F135',
  ink: '#1A1A1A',
  bone: '#F0EDE8',
};

const light = {
  background: brand.bone,
  surface: '#FFFFFF',
  text: brand.ink,
  muted: '#5E5953',
  border: '#DDD7CF',
  primary: brand.magentaDeep,
  onPrimary: '#FFFFFF',
  accent: brand.volt,
  onAccent: '#2A3300',
  danger: '#B42318',
  dangerSoft: '#FDECEA',
};

const dark: typeof light = {
  background: '#141313',
  surface: '#1E1D1C',
  text: brand.bone,
  muted: '#A8A199',
  border: '#34312E',
  primary: brand.magenta,
  onPrimary: '#FFFFFF',
  accent: brand.volt,
  onAccent: '#2A3300',
  danger: '#FF8A80',
  dangerSoft: '#3A1A18',
};

export type ThemeColors = typeof light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const font = {
  title: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
};

export function useTheme(): ThemeColors {
  return useColorScheme() === 'dark' ? dark : light;
}
