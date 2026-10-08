import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, ErrorView, LoadingView, ProgressBar, Screen, SectionLabel, Txt } from '@/components/ui';
import { useUserId } from '@/lib/account';
import { useCourse, useMarkWatched, type Video } from '@/lib/courses';
import { radius, spacing, useTheme } from '@/theme';

function formatDuration(sec: number | null) {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}min ${s}s` : `${m}min`;
}

const isYouTube = (url: string) => /youtube\.com|youtu\.be/.test(url);

export default function TecnicaScreen() {
  const { skillId } = useLocalSearchParams<{ skillId: string }>();
  const userId = useUserId();
  const course = useCourse(userId, skillId);
  const mark = useMarkWatched(userId, skillId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const videos = course.data?.videos ?? [];
    const phases = [...new Set(videos.map((v) => v.phase).filter((p): p is string => !!p))];
    return phases.length > 0 ? phases.map((p) => ({ phase: p, videos: videos.filter((v) => v.phase === p) })) : [{ phase: null, videos }];
  }, [course.data]);

  if (course.isPending) return <LoadingView />;
  if (course.isError) return <ErrorView message="Não foi possível carregar os vídeos." onRetry={() => course.refetch()} />;

  const { skill, videos } = course.data;
  const selected = videos.find((v) => v.id === selectedId) ?? null;
  const watched = videos.filter((v) => v.watched).length;

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: skill?.name ?? '' }} />
      <View style={styles.header}>
        <Text style={{ fontSize: 38 }}>{skill?.icon}</Text>
        <View style={{ flex: 1 }}>
          <Txt variant="title">{skill?.name}</Txt>
          {skill?.description ? <Txt color="muted">{skill.description}</Txt> : null}
        </View>
      </View>

      <Card>
        <View style={styles.rowBetween}>
          <Txt variant="subheading">Seu progresso</Txt>
          <Txt variant="small" color="muted">
            {watched} de {videos.length} vídeos
          </Txt>
        </View>
        <ProgressBar value={videos.length ? watched / videos.length : 0} height={8} />
      </Card>

      {selected && <Player key={selected.id} video={selected} onWatched={() => mark.mutate(selected.id)} marking={mark.isPending} />}

      {videos.length === 0 && <EmptyState emoji="🎬" title="Vídeos em breve" message="O conteúdo desta skill está sendo gravado." />}

      {groups.map((g) => (
        <View key={g.phase ?? 'all'} style={{ gap: spacing.sm }}>
          {g.phase && <SectionLabel>{g.phase}</SectionLabel>}
          {g.videos.map((v) => (
            <VideoRow key={v.id} video={v} selected={v.id === selectedId} onPress={() => setSelectedId(v.id)} />
          ))}
        </View>
      ))}
    </Screen>
  );
}

function VideoRow({ video, selected, onPress }: { video: Video; selected: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.video, { backgroundColor: c.surface, borderColor: selected ? c.primary : c.border, borderWidth: selected ? 2 : StyleSheet.hairlineWidth }]}
    >
      <View style={[styles.thumb, { backgroundColor: video.watched ? c.primarySoft : c.surfaceMuted }]}>
        <Ionicons name={video.watched ? 'checkmark-circle' : 'play'} size={22} color={video.watched ? c.primary : c.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="subheading" color={video.watched ? 'primary' : 'text'}>
          {video.title}
        </Txt>
        {video.duration_sec ? (
          <Txt variant="small" color="muted">
            {formatDuration(video.duration_sec)}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

function Player({ video, onWatched, marking }: { video: Video; onWatched: () => void; marking: boolean }) {
  const c = useTheme();
  const url = video.video_url;
  const youtube = !!url && isYouTube(url);

  return (
    <View style={[styles.player, { backgroundColor: c.text }]}>
      {url && !youtube ? (
        <NativeVideo url={url} onEnd={() => !video.watched && onWatched()} />
      ) : (
        <View style={styles.placeholder}>
          {youtube ? (
            <Button label="Assistir no YouTube" icon="logo-youtube" onPress={() => WebBrowser.openBrowserAsync(url!)} />
          ) : (
            <Txt color="muted">Vídeo em breve</Txt>
          )}
        </View>
      )}
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <Txt variant="heading" style={{ color: c.background }}>
          {video.title}
        </Txt>
        {video.description ? <Txt style={{ color: c.background, opacity: 0.7 }}>{video.description}</Txt> : null}
        {video.watched ? (
          <Txt variant="label" style={{ color: c.background, opacity: 0.7 }}>
            ✓ Assistido
          </Txt>
        ) : (
          <Button label="Marcar como assistido" onPress={onWatched} loading={marking} />
        )}
      </View>
    </View>
  );
}

function NativeVideo({ url, onEnd }: { url: string; onEnd: () => void }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  useEventListener(player, 'playToEnd', onEnd);

  return (
    <View>
      <VideoView player={player} style={styles.videoView} fullscreenOptions={{ enable: true }} nativeControls />
      {status === 'error' && (
        <View style={[styles.placeholder, StyleSheet.absoluteFill]}>
          <Txt color="muted">Não foi possível carregar o vídeo.</Txt>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  video: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, padding: spacing.md },
  thumb: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  player: { borderRadius: radius.lg, overflow: 'hidden' },
  videoView: { width: '100%', aspectRatio: 16 / 9 },
  placeholder: { aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
});
