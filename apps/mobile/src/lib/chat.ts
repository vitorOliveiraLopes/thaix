import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { buildChatTimeline, parseAttachments, type ActionDbStatus, type ActionState, type ChatAttachment } from '@thaix/core';

import { qk } from './query';
import { supabase } from './supabase';

export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; created_at: string; attachments: ChatAttachment[] };
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
        // '*': funciona antes e depois da coluna attachments existir.
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT);
      if (error) throw new Error(error.message);
      const messages: ChatMessage[] = (rows ?? []).map((m) => ({
        id: m.id as string,
        role: m.role as ChatMessage['role'],
        content: m.content as string,
        created_at: m.created_at as string,
        attachments: parseAttachments(m.attachments),
      }));

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

