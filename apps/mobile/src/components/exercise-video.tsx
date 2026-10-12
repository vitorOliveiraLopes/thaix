import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { tapFeedback, Txt } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

/**
 * Vídeo curto do exercício (a explicação da Thaís). Fica recolhido: o
 * aluno abre quando quiser, e o vídeo só carrega depois do toque.
 */
export function ExerciseVideo({ url }: { url: string }) {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          tapFeedback();
          setOpen((o) => !o);
        }}
        style={[styles.toggle, { backgroundColor: c.primarySoft }]}
      >
        <Ionicons name={open ? 'chevron-up' : 'play-circle'} size={18} color={c.primary} />
        <Txt variant="label" color="primary">
          {open ? 'Esconder vídeo' : 'Ver vídeo da Thaís'}
        </Txt>
      </Pressable>
      {open && <Player url={url} />}
    </View>
  );
}

function Player({ url }: { url: string }) {
  const c = useTheme();
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  return (
    <View style={[styles.video, { backgroundColor: c.surfaceMuted }]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} fullscreenOptions={{ enable: true }} nativeControls contentFit="contain" />
      {status === 'error' && (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Txt color="muted">Não foi possível carregar o vídeo.</Txt>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  video: { width: '100%', aspectRatio: 9 / 16, maxHeight: 420, borderRadius: radius.md, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
