import { useQuery } from '@tanstack/react-query';

import { qk } from './query';
import { supabase } from './supabase';

export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string };
export type PendingAction = { id: string; toolName: string; summary: string; preview: string[] };

/** Propostas mais velhas que isso o servidor recusa; não vale mostrar. */
const PROPOSAL_TTL_MS = 30 * 60_000;

/**
 * Conversa e propostas pendentes vêm do servidor: se o app fechar ou a
 * resposta demorar, nada se perde ao reabrir o chat.
 */
export function useChatHistory(userId: string) {
  return useQuery({
    queryKey: qk.chat(userId),
    queryFn: async () => {
      const since = new Date(Date.now() - PROPOSAL_TTL_MS).toISOString();
      const [messages, pending] = await Promise.all([
        supabase
          .from('chat_messages')
          .select('id, role, content')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('chat_pending_actions')
          .select('id, tool_name, summary, params')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .gte('created_at', since)
          .order('created_at', { ascending: true }),
      ]);
      if (messages.error) throw new Error(messages.error.message);
      return {
        messages: ((messages.data ?? []) as ChatMessage[]).reverse(),
        pending: (pending.data ?? []).map((p) => ({
          id: p.id as string,
          toolName: p.tool_name as string,
          summary: p.summary as string,
          preview: ((p.params as { preview?: string[] } | null)?.preview ?? []) as string[],
        })) as PendingAction[],
      };
    },
  });
}
