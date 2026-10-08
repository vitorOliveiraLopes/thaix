import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { buildChatTimeline, type ActionDbStatus, type ActionState } from '@thaix/core';

import { qk } from './query';
import { supabase } from './supabase';

export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; created_at: string };
export type ChatAction = {
  id: string;
  toolName: string;
  summary: string;
  preview: string[];
  status: ActionDbStatus;
  result_note: string | null;
  created_at: string;
};
export type ChatEntry = { kind: 'msg'; msg: ChatMessage } | { kind: 'action'; action: ChatAction; state: ActionState };

const HISTORY_LIMIT = 50;

/**
 * Conversa e propostas (com a decisão do aluno) vêm do servidor: se o app
 * fechar ou a resposta demorar, nada se perde ao reabrir o chat.
 */
export function useChatHistory(userId: string) {
  const query = useQuery({
    queryKey: qk.chat(userId),
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT);
      if (error) throw new Error(error.message);
      const messages = (rows ?? []) as ChatMessage[];

      // Propostas do mesmo período (toda a conversa carregada).
      const oldest = messages.length ? messages[messages.length - 1].created_at : new Date(0).toISOString();
      const { data: acts, error: actsError } = await supabase
        .from('chat_pending_actions')
        .select('id, tool_name, summary, params, status, result_note, created_at')
        .eq('user_id', userId)
        .gte('created_at', oldest)
        .order('created_at', { ascending: true })
        .limit(HISTORY_LIMIT);
      if (actsError) throw new Error(actsError.message);

      const actions: ChatAction[] = (acts ?? []).map((a) => ({
        id: a.id as string,
        toolName: a.tool_name as string,
        summary: a.summary as string,
        preview: ((a.params as { preview?: string[] } | null)?.preview ?? []) as string[],
        status: a.status as ActionDbStatus,
        result_note: (a.result_note as string | null) ?? null,
        created_at: a.created_at as string,
      }));
      return { entries: buildChatTimeline(messages, actions) as ChatEntry[], count: messages.length };
    },
  });

  // A aba fica montada: ao voltar para ela, busca de novo (a conversa pode
  // ter mudado em outro aparelho ou ter sido apagada).
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );
  return query;
}

/**
 * Apaga a conversa do aluno (mensagens e propostas). O coach começa do zero
 * na conversa, mas continua vendo os dados do aluno (treino, box, objetivos).
 */
export async function clearChat(userId: string) {
  // Propostas primeiro: se a segunda parte falhar, não sobram cards soltos.
  const actions = await supabase.from('chat_pending_actions').delete().eq('user_id', userId);
  if (actions.error) throw new Error(actions.error.message);
  const messages = await supabase.from('chat_messages').delete().eq('user_id', userId);
  if (messages.error) throw new Error(messages.error.message);
}
