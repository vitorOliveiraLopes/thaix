'use client'

import { useRouter } from 'next/navigation'
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader'

export default function OnboardingApresentacao() {
  const router = useRouter()

  return (
    <div className="flex flex-col min-h-screen max-w-sm mx-auto w-full">
      <OnboardingHeader />

      <div className="flex-1 flex flex-col px-5 py-6">
        {/* Avatar grande da coach */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-full bg-primary/20 border-4 border-primary/30 flex items-center justify-center mb-4">
            <span className="text-4xl font-extrabold text-primary">T</span>
          </div>
          <h2 className="text-2xl font-extrabold text-foreground text-center">
            Oi, eu sou a Thaix.
          </h2>
        </div>

        <div className="bg-white rounded-2xl p-5 space-y-4 shadow-sm text-sm leading-relaxed text-foreground">
          <p>
            Eu treino e ensino CrossFit há anos, e crio conteúdo focado no que ninguém quer filmar:{' '}
            <strong>os progressivos básicos</strong> que destravam os skills.
          </p>
          <p>
            Atendo dezenas de alunas por consultoria toda semana e a queixa é sempre a mesma:{' '}
            <em className="text-primary">"travei no pull-up", "não consigo o toes-to-bar", "muscle-up parece impossível".</em>{' '}
            O problema quase nunca é força — é técnica que não foi ensinada.
          </p>
          <p>
            Aqui no app eu te entrego o método completo: mobilidade específica, força específica,
            educativos do zero e progressões em camadas. Pra você fazer entre as aulas da sua box.
          </p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-lg font-bold text-primary italic">Thaix</p>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">THAIXSKILL</p>
        </div>
      </div>

      <div className="px-5 pb-8">
        <button
          onClick={() => router.push('/onboarding/motivacao')}
          className="w-full h-14 bg-primary text-white font-bold text-base rounded-full hover:bg-primary/90 transition-colors"
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
