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

export async function callClaude(staticPrompt: string, dynamicPrompt: string, messages: Message[]): Promise<ClaudeResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)
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
        max_tokens: 900,
        system: [
          { type: 'text', text: staticPrompt, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: dynamicPrompt },
        ],
        tools: TOOLS,
        messages,
      }),
    })
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`)
    return (await res.json()) as ClaudeResponse
  } finally {
    clearTimeout(timer)
  }
}
