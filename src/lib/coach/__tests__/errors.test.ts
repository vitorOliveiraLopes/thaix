import { describe, it, expect } from 'vitest'
import { AnthropicError, anthropicKey, describeCoachError } from '../anthropic'

describe('describeCoachError', () => {
  it('chave ausente no servidor', () => {
    expect(describeCoachError(new Error('missing_api_key')).code).toBe('ai_not_configured')
  })
  it('chave inválida', () => {
    expect(describeCoachError(new AnthropicError(401, 'authentication_error', 'invalid x-api-key')).code).toBe('ai_auth')
  })
  it('sem créditos', () => {
    expect(describeCoachError(new AnthropicError(400, 'invalid_request_error', 'Your credit balance is too low')).code).toBe('ai_billing')
  })
  it('modelo inexistente', () => {
    expect(describeCoachError(new AnthropicError(404, 'not_found_error', 'model: x')).code).toBe('ai_model')
  })
  it('sobrecarga', () => {
    expect(describeCoachError(new AnthropicError(529, 'overloaded_error', 'Overloaded')).code).toBe('ai_busy')
  })
  it('tempo esgotado', () => {
    const e = new Error('aborted')
    e.name = 'AbortError'
    expect(describeCoachError(e).code).toBe('ai_timeout')
  })
  it('qualquer outro erro não vaza detalhes', () => {
    const info = describeCoachError(new Error('relation "x" does not exist'))
    expect(info.code).toBe('internal')
    expect(info.message).not.toContain('relation')
  })
})

describe('anthropicKey', () => {
  it('remove espaço, quebra de linha e aspas coladas no painel', () => {
    expect(anthropicKey('  sk-ant-abc\n')).toBe('sk-ant-abc')
    expect(anthropicKey('"sk-ant-abc"')).toBe('sk-ant-abc')
    expect(anthropicKey("'sk-ant-abc' ")).toBe('sk-ant-abc')
  })
  it('vazio vira ausente', () => {
    expect(anthropicKey('  ')).toBeNull()
    expect(anthropicKey(undefined)).toBeNull()
  })
  it('403 é permissão, não chave inválida', () => {
    expect(describeCoachError(new AnthropicError(403, 'permission_error', 'x')).code).toBe('ai_permission')
  })
})
