export type PhysicalTestResult = {
  pushups: number
  pullups: number
  squats: number
}

export function calculateScore({ pushups, pullups, squats }: PhysicalTestResult): number {
  return pushups + pullups * 2 + squats / 2
}

export function recommendProtocol(test: PhysicalTestResult): string {
  const { pushups, pullups } = test
  const score = calculateScore(test)

  // Regra forte: avançado
  if (pushups >= 20 && pullups >= 5) return 'avancado'

  // Sem barra
  if (pullups === 0) {
    if (score < 8) return 'iniciante'
    return 'intermediario'
  }

  // Por score
  if (score < 10) return 'iniciante'
  if (score < 25) return 'intermediario'
  return 'avancado'
}

export function getProtocolLevel(pushups: number): string {
  if (pushups < 5) return 'Iniciante — Fase 1'
  if (pushups <= 10) return 'Iniciante Avançado — Fase 2'
  if (pushups <= 20) return 'Intermediário — Fase 3'
  return 'Avançado — Fase 4'
}

export const PROTOCOL_LABELS: Record<string, { name: string; description: string; color: string }> = {
  iniciante: {
    name: 'Protocolo Iniciante',
    description: '28 dias pra construir a base: padrão de movimento e força inicial.',
    color: 'text-emerald-600',
  },
  intermediario: {
    name: 'Protocolo Intermediário',
    description: '28 dias com mais volume e introdução às primeiras skills.',
    color: 'text-blue-600',
  },
  avancado: {
    name: 'Protocolo Avançado',
    description: '28 dias avançados: muscle-up, handstand, pistol e força máxima.',
    color: 'text-purple-600',
  },
}