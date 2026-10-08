import { isRestDay, normalizeLevel, selectSkillsForToday, type Protocol } from '@thaix/core';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, ErrorBox } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { font, radius, spacing, useTheme } from '@/theme';

const SKILL_NAMES: Record<string, string> = {
  'pull-up': 'Pull-up',
  c2b: 'Chest to Bar',
  bmu: 'Bar Muscle-up',
  t2b: 'Toes to Bar',
  hspu: 'Handstand Push-up',
};

const LEVEL_LABELS: Record<Protocol, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

type SkillProgress = { skill_id: string; level: string; week_number: number };

type HomeData = {
  name: string | null;
  progress: SkillProgress[];
  trainingDays: number[];
};

type LoadResult = { ok: true; data: HomeData } | { ok: false };

async function fetchHomeData(userId: string): Promise<LoadResult> {
  const [profileRes, progressRes, onboardingRes] = await Promise.all([
    supabase.from('profiles').select('name').eq('user_id', userId).maybeSingle(),
    supabase.from('user_skill_progress').select('skill_id, level, week_number').eq('user_id', userId),
    supabase.from('onboarding_responses').select('dias_semana').eq('user_id', userId).maybeSingle(),
  ]);

  if (profileRes.error || progressRes.error || onboardingRes.error) return { ok: false };

  return {
    ok: true,
    data: {
      name: profileRes.data?.name ?? null,
      progress: (progressRes.data ?? []) as SkillProgress[],
      trainingDays: (onboardingRes.data?.dias_semana ?? []) as number[],
    },
  };
}

export default function HomeScreen() {
  const c = useTheme();
  const { session, signOut } = useAuth();
  const userId = session?.user.id;

  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const applyResult = useCallback((result: LoadResult) => {
    if (result.ok) {
      setError(null);
      setData(result.data);
    } else {
      setError('Não foi possível carregar seus dados. Puxe a tela para tentar de novo.');
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchHomeData(userId).then((result) => {
      if (active) applyResult(result);
    });
    return () => {
      active = false;
    };
  }, [userId, applyResult]);

  async function onRefresh() {
    if (!userId) return;
    setRefreshing(true);
    applyResult(await fetchHomeData(userId));
    setRefreshing(false);
  }

  const today = new Date().getDay();
  const firstName = data?.name?.split(' ')[0] ?? session?.user.email?.split('@')[0] ?? '';
  const restDay = data ? isRestDay(data.trainingDays, today) : false;
  // Mesma regra de combinação de skills que o gerador usa, vinda do @thaix/core.
  const todaySkills = data ? selectSkillsForToday(data.progress.map((p) => p.skill_id), today) : [];

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={[font.body, { color: c.muted }]}>Olá{firstName ? `, ${firstName}` : ''}</Text>
          <Text style={[font.title, { color: c.text }]}>{restDay ? 'Hoje é dia de descanso' : 'Treinos de hoje'}</Text>
        </View>

        {error && <ErrorBox>{error}</ErrorBox>}

        {data && data.trainingDays.length > 0 && (
          <View style={styles.week} accessibilityLabel="Seus dias de treino">
            {WEEKDAYS.map((label, i) => {
              const trains = data.trainingDays.includes(i);
              const isToday = i === today;
              return (
                <View
                  key={label}
                  style={[
                    styles.day,
                    { borderColor: isToday ? c.primary : c.border, backgroundColor: trains ? c.accent : c.surface },
                  ]}
                >
                  <Text style={[font.caption, { color: trains ? c.onAccent : c.muted }]}>{label}</Text>
                </View>
              );
            })}
          </View>
        )}

        {data && data.progress.length === 0 && (
          <Card>
            <Text style={[font.heading, { color: c.text }]}>Falta escolher suas skills</Text>
            <Text style={[font.body, { color: c.muted }]}>
              O onboarding chega ao app na próxima etapa. Por enquanto, as skills vêm do que você já preencheu na versão web.
            </Text>
          </Card>
        )}

        {data && !restDay && todaySkills.length > 0 && (
          <View style={{ gap: spacing.md }}>
            {todaySkills.map((skillId) => {
              const p = data.progress.find((x) => x.skill_id === skillId);
              const level = normalizeLevel(p?.level ?? 'iniciante');
              return (
                <Card key={skillId}>
                  <View style={styles.row}>
                    <Text style={[font.heading, { color: c.text, flex: 1 }]}>{SKILL_NAMES[skillId] ?? skillId}</Text>
                    <View style={[styles.badge, { backgroundColor: c.accent }]}>
                      <Text style={[font.caption, { color: c.onAccent }]}>{LEVEL_LABELS[level]}</Text>
                    </View>
                  </View>
                  <Text style={[font.body, { color: c.muted, fontSize: 14 }]}>
                    Semana {p?.week_number ?? 1}. A tela de treino chega na próxima etapa.
                  </Text>
                </Card>
              );
            })}
          </View>
        )}

        {data && restDay && (
          <Card>
            <Text style={[font.body, { color: c.muted }]}>
              Recuperar também faz parte da evolução. Seu próximo treino aparece aqui no próximo dia marcado.
            </Text>
          </Card>
        )}

        <View style={styles.footer}>
          <Button label="Sair" variant="ghost" onPress={signOut} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.xl, gap: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  week: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  footer: { marginTop: spacing.lg },
});
