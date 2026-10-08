import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from './query';
import { supabase } from './supabase';

export type CourseSkill = { id: string; name: string; description: string | null; icon: string | null; total: number; watched: number };

export type Video = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  duration_sec: number | null;
  order_index: number;
  phase: string | null;
  watched: boolean;
};

export function useCourses(userId: string) {
  return useQuery({
    queryKey: qk.courses(userId),
    queryFn: async (): Promise<CourseSkill[]> => {
      // Contagens em consultas separadas: mais previsível que joins aninhados no PostgREST.
      const [skills, videos, watched] = await Promise.all([
        supabase.from('skills').select('id, name, description, icon, order_index').order('order_index'),
        supabase.from('skill_videos').select('id, skill_id'),
        supabase.from('user_video_progress').select('video_id').eq('user_id', userId),
      ]);
      if (skills.error) throw new Error(skills.error.message);
      const seen = new Set((watched.data ?? []).map((v) => v.video_id as string));
      const all = videos.data ?? [];
      return (skills.data ?? []).map((s) => {
        const mine = all.filter((v) => v.skill_id === s.id);
        return {
          id: s.id as string,
          name: s.name as string,
          description: (s.description as string | null) ?? null,
          icon: (s.icon as string | null) ?? null,
          total: mine.length,
          watched: mine.filter((v) => seen.has(v.id as string)).length,
        };
      });
    },
  });
}

export function useCourse(userId: string, skillId: string) {
  return useQuery({
    queryKey: qk.course(userId, skillId),
    queryFn: async () => {
      const [skill, videos, watched] = await Promise.all([
        supabase.from('skills').select('id, name, description, icon').eq('id', skillId).maybeSingle(),
        supabase
          .from('skill_videos')
          .select('id, title, description, video_url, duration_sec, order_index, phase')
          .eq('skill_id', skillId)
          .order('order_index'),
        supabase.from('user_video_progress').select('video_id').eq('user_id', userId),
      ]);
      if (videos.error) throw new Error(videos.error.message);
      const seen = new Set((watched.data ?? []).map((v) => v.video_id as string));
      return {
        skill: skill.data as { id: string; name: string; description: string | null; icon: string | null } | null,
        videos: (videos.data ?? []).map((v) => ({ ...v, watched: seen.has(v.id as string) })) as Video[],
      };
    },
  });
}

export function useMarkWatched(userId: string, skillId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase
        .from('user_video_progress')
        .upsert({ user_id: userId, video_id: videoId, watch_count: 1 }, { onConflict: 'user_id,video_id', ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.course(userId, skillId) });
      client.invalidateQueries({ queryKey: qk.courses(userId) });
    },
  });
}
