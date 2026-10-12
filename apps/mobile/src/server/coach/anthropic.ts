import { toolsForApi } from '@thaix/core'

export const COACH_MODEL = process.env.COACH_MODEL ?? 'claude-sonnet-5-5'

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

export type Message = { role: 'user' | 'assistant'; content: string | ContentBlock[] }

export type ClaudeResponse = {
  content: ContentBlock[]
  stop_reason: string
  usage?: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
}

// Ferramentas são iguais para todos: a última recebe cache_control e o
// bloco inteiro de ferramentas entra no cache junto com o prompt fixo.
const TOOLS = toolsForApi().map((t, i, all) => (i === all.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t))

/**
 * @param allowTools false na última rodada: o modelo precisa responder em texto
 *   (as definições continuam presentes porque o histórico tem blocos de ferramenta).
 */
/** Erro da API da Anthropic com o tipo, para a rota dizer ao aluno o que houve. */
export class AnthropicError extends Error {
  constructor(
    readonly status: number,
    readonly errorType: string,
    message: string,
  ) {
    super(message)
  }
}

/**
 * Traduz falhas do coach em mensagem para o aluno + código para o log.
 * Nunca expõe a chave nem detalhes internos.
 */
export function describeCoachError(err: unknown): { code: string; message: string; status: number } {
  if (err instanceof AnthropicError) {
    const msg = err.message.toLowerCase()
    if (err.status === 401 || err.status === 403)
      return { code: 'ai_auth', status: 503, message: 'O coach está sem acesso à IA (chave inválida no servidor). Avise o suporte.' }
    if (msg.includes('credit balance') || msg.includes('billing'))
      return { code: 'ai_billing', status: 503, message: 'O coach está temporariamente sem créditos de IA. Avise o suporte.' }
    if (err.status === 404 || err.errorType === 'not_found_error')
      return { code: 'ai_model', status: 503, message: 'O modelo de IA configurado não está disponível. Avise o suporte.' }
    if (err.status === 429 || err.status === 529 || err.errorType === 'overloaded_error')
      return { code: 'ai_busy', status: 503, message: 'O coach está com muita demanda agora. Tente de novo em alguns segundos.' }
    return { code: `ai_${err.status}`, status: 502, message: 'O coach não conseguiu responder agora. Tente de novo em instantes.' }
  }
  if (err instanceof Error && err.name === 'AbortError')
    return { code: 'ai_timeout', status: 504, message: 'O coach demorou demais para responder. Tente uma pergunta mais curta.' }
  if (err instanceof Error && err.message === 'missing_api_key')
    return { code: 'ai_not_configured', status: 503, message: 'O coach ainda não foi configurado no servidor (chave da IA ausente). Avise o suporte.' }
  return { code: 'internal', status: 500, message: 'O coach está indisponível agora. Tente em instantes.' }
}

export async function callClaude(
  staticPrompt: string,
  dynamicPrompt: string,
  messages: Message[],
  { allowTools = true, timeoutMs = 25_000 }: { allowTools?: boolean; timeoutMs?: number } = {},
): Promise<ClaudeResponse> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('missing_api_key')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: COACH_MODEL,
        // Respostas são curtas; limite baixo também reduz o tempo de resposta.
        max_tokens: 600,
        system: [
          { type: 'text', text: staticPrompt, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: dynamicPrompt },
        ],
        tools: TOOLS,
        ...(allowTools ? {} : { tool_choice: { type: 'none' } }),
        messages,
      }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { type?: string; message?: string } } | null
      throw new AnthropicError(res.status, body?.error?.type ?? 'unknown', body?.error?.message ?? `HTTP ${res.status}`)
    }
    return (await res.json()) as ClaudeResponse
  } finally {
    clearTimeout(timer)
  }
}
