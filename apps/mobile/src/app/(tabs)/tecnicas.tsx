import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, ErrorBox, LoadingView, ProgressBar, Screen, Txt } from '@/components/ui';
import { useUserId } from '@/lib/account';
import { useCourses } from '@/lib/courses';
import { spacing } from '@/theme';

export default function TecnicasScreen() {
  const userId = useUserId();
  const courses = useCourses(userId);

  if (courses.isPending) return <LoadingView />;

  return (
    <Screen onRefresh={() => courses.refetch()} refreshing={courses.isRefetching}>
      <View style={{ gap: spacing.xs }}>
        <Txt variant="title">Técnicas</Txt>
        <Txt color="muted">Vídeos educativos por skill com a Coach Thaix</Txt>
      </View>
      {courses.isError && <ErrorBox>Não foi possível carregar os vídeos. Puxe para tentar de novo.</ErrorBox>}
      {courses.data?.length === 0 && <EmptyState emoji="🎬" title="Vídeos em breve" message="A Thaís está gravando o conteúdo de cada skill." />}
      <View style={styles.grid}>
        {(courses.data ?? []).map((s) => {
          const pct = s.total > 0 ? s.watched / s.total : 0;
          return (
            <Card key={s.id} style={styles.tile} onPress={() => router.push(`/tecnica/${s.id}`)}>
              <Text style={{ fontSize: 26 }}>{s.icon}</Text>
              <Txt variant="subheading">{s.name}</Txt>
              <Txt variant="small" color="muted">
                {s.total} vídeos
              </Txt>
              <ProgressBar value={pct} />
              <Txt variant="small" color="muted">
                {pct === 0 ? 'Não iniciado' : pct === 1 ? '✓ Concluído' : `${s.watched} de ${s.total}`}
              </Txt>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '48.5%', gap: spacing.xs },
});
