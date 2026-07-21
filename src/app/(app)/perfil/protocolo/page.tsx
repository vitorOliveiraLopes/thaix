'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

// ─── Protocolo page ───────────────────────────────────────────────────────────
//
// O sistema de protocolos foi substituído pelo sistema de skills com progressão
// automática. Esta página é um placeholder que não depende de nenhuma tabela
// legada e será expandida futuramente como "Gerenciar Skills".

export default function TrocarProtocoloPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto px-4 pt-10 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-muted rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-extrabold">Treino</h1>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-3">
          <p className="text-3xl">🏋️</p>
          <p className="font-bold">Seus treinos são personalizados automaticamente</p>
          <p className="text-sm text-muted-foreground">
            O algoritmo gera treinos diários com base no seu nível atual em cada skill.
            A progressão acontece automaticamente conforme você completa sessões.
          </p>
          <button
            onClick={() => router.push('/treinos')}
            className="text-sm font-bold text-primary hover:text-primary/80 transition-colors"
          >
            Ver meu desempenho →
          </button>
        </div>
      </div>
    </div>
  )
}
