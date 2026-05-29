'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, MessageCircle, FileText, Shield } from 'lucide-react'

export default function SuportePage() {
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
          <h1 className="text-xl font-semibold">Ajuda e Suporte</h1>
        </div>

        <div className="border rounded-2xl divide-y divide-border overflow-hidden">
          <button
            onClick={() => window.open('https://wa.me/5524998315673', '_blank')}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Falar com suporte</p>
              <p className="text-xs text-muted-foreground">
                Atendimento via WhatsApp
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push('/termos')}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Termos de uso</p>
              <p className="text-xs text-muted-foreground">
                Leia nossos termos
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push('/privacidade')}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Política de privacidade</p>
              <p className="text-xs text-muted-foreground">
                Como seus dados são usados
              </p>
            </div>
          </button>
        </div>

        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground">ThaixSkill v1.0</p>
          <p className="text-xs text-muted-foreground">
            Feito com 💪 para atletas de verdade
          </p>
        </div>

      </div>
    </div>
  )
}