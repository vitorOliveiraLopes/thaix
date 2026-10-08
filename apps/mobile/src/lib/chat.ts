import { useQuery } from '@tanstack/react-query';

import { qk } from './query';
import { supabase } from './supabase';

export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string };
export type PendingAction = { id: string; toolName: string; summary: string; status: 'pending' | 'confirmed' | 'declined' };

export function useChatHistory(userId: string) {
  return useQuery({
    queryKey: qk.chat(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return ((data ?? []) as ChatMessage[]).reverse();
    },
    staleTime: Infinity,
  });
}
