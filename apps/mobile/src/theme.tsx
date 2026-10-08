import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  surfaceMuted: '#E8E3DC',
  text: brand.ink,
  muted: '#5E5953',
  border: '#DDD7CF',
  primary: brand.magentaDeep,
  primarySoft: '#FCE3F1',
  onPrimary: '#FFFFFF',
  accent: brand.volt,
  onAccent: '#2A3300',
  danger: '#B42318',
  dangerSoft: '#FDECEA',
  success: '#1E7A3C',
  successSoft: '#E3F5E8',
  warning: '#9A5B00',
  warningSoft: '#FFF1DC',
  info: '#1D4E9E',
  overlay: 'rgba(26,26,26,0.45)',
  // Cores dos níveis (mesma ideia da web: verde, azul, roxo)
  levelIniciante: '#1E7A3C',
  levelIntermediario: '#1D4E9E',
  levelAvancado: '#6B2FB3',
  levelInicianteSoft: '#E3F5E8',
  levelIntermediarioSoft: '#E3ECFB',
  levelAvancadoSoft: '#EFE5FA',
};

const dark: typeof light = {
  background: '#141313',
  surface: '#1E1D1C',
  surfaceMuted: '#2A2826',
  text: brand.bone,
  muted: '#A8A199',
  border: '#34312E',
  primary: brand.magenta,
  primarySoft: '#3A1429',
  onPrimary: '#FFFFFF',
  accent: brand.volt,
  onAccent: '#2A3300',
  danger: '#FF8A80',
  dangerSoft: '#3A1A18',
  success: '#7CD992',
  successSoft: '#163322',
  warning: '#FFC57A',
  warningSoft: '#3A2810',
  info: '#9CC2FF',
  overlay: 'rgba(0,0,0,0.6)',
  levelIniciante: '#7CD992',
  levelIntermediario: '#9CC2FF',
  levelAvancado: '#C9A6F5',
  levelInicianteSoft: '#163322',
  levelIntermediarioSoft: '#16263F',
  levelAvancadoSoft: '#2A1A3D',
};

export type ThemeColors = typeof light;
export type ThemePreference = 'light' | 'dark' | 'system';

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;
export const font = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.8 },
  title: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 18, fontWeight: '800' as const },
  subheading: { fontSize: 15, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.2 },
  number: { fontVariant: ['tabular-nums' as const] },
};

const PREF_KEY = 'thaix.theme';

type ThemeState = {
  colors: ThemeColors;
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

/**
 * Tema do app. A preferência (claro, escuro, sistema) fica salva no aparelho
 * para valer já na abertura; a tela de Preferências também grava no Supabase.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    SecureStore.getItemAsync(PREF_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') setPreferenceState(saved);
      })
      .catch(() => {});
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    SecureStore.setItemAsync(PREF_KEY, p).catch(() => {});
  }, []);

  const value = useMemo<ThemeState>(() => {
    const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
    return { colors: scheme === 'dark' ? dark : light, scheme, preference, setPreference };
  }, [preference, system, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeState(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme precisa estar dentro de <AppThemeProvider>.');
  return ctx;
}

export function useTheme(): ThemeColors {
  return useThemeState().colors;
}

export function useThemePreference() {
  const { scheme, preference, setPreference } = useThemeState();
  return { scheme, preference, setPreference };
}

export function levelColors(c: ThemeColors, level: string): { fg: string; bg: string } {
  if (level === 'avancado') return { fg: c.levelAvancado, bg: c.levelAvancadoSoft };
  if (level === 'intermediario') return { fg: c.levelIntermediario, bg: c.levelIntermediarioSoft };
  return { fg: c.levelIniciante, bg: c.levelInicianteSoft };
}
