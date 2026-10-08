import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button, Txt } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { radius, spacing, useTheme } from '@/theme';

type Achievement = { id: string; type: string; name: string; description: string | null; threshold: number | null };

/** Comemoração das conquistas desbloqueadas ao concluir um treino. */
export function AchievementModal({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const c = useTheme();
  const [index, setIndex] = useState(0);
  const { data, isError } = useQuery({
    queryKey: ['achievements-by-id', ids],
    queryFn: async () => {
      const { data: rows } = await supabase.from('achievements').select('id, type, name, description, threshold').in('id', ids);
      return (rows ?? []) as Achievement[];
    },
    enabled: ids.length > 0,
  });

  const list = data ?? [];
  const nothingToShow = isError || (data !== undefined && data.length === 0);

  // Sem conquistas para mostrar (erro ou RLS), segue o fluxo em vez de travar a tela.
  useEffect(() => {
    if (nothingToShow) onClose();
  }, [nothingToShow, onClose]);

  const current = list[index];
  if (!current) return null;
  const last = index === list.length - 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: c.overlay }]}>
        <View style={[styles.card, { backgroundColor: c.background }]}>
          <Txt variant="caption" color="primary">
            CONQUISTA DESBLOQUEADA
          </Txt>
          <View style={[styles.badge, { backgroundColor: c.text }]}>
            <Text style={{ fontSize: 48 }}>{current.type === 'session_count' ? '🏆' : current.type === 'skill_level' ? '⭐' : '💪'}</Text>
          </View>
          <Txt variant="title" center>
            {current.name}
          </Txt>
          {current.description ? (
            <Txt color="muted" center>
              {current.description}
            </Txt>
          ) : null}
          {current.threshold ? <Txt variant="subheading">🎯 {current.threshold} treinos concluídos</Txt> : null}
          {list.length > 1 && (
            <View style={styles.dots}>
              {list.map((a, i) => (
                <View key={a.id} style={[styles.dot, { backgroundColor: i === index ? c.text : c.border }]} />
              ))}
            </View>
          )}
          <Button
            label={last ? 'Continuar' : `Próxima (${index + 1}/${list.length})`}
            onPress={() => (last ? onClose() : setIndex((i) => i + 1))}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 380, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  badge: { width: 96, height: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
