import Image from 'next/image'
import Link from 'next/link'

const HERO_IMAGE_URL =
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/thaix_home.JPG`

export default function LandingPage() {
  return (
    // Fundo neutro da página — visível nas laterais em desktop
    <div className="min-h-screen bg-background flex items-center justify-center">

      {/* Container mobile — máx 390px, ocupa a tela inteira em mobile */}
      <div className="relative w-full max-w-[390px] min-h-screen overflow-hidden bg-foreground">

        {/* Foto hero */}
        <div className="absolute inset-0">
          <Image
            src={HERO_IMAGE_URL}
            alt="Coach Thaix"
            fill
            className="object-cover object-top"
            priority
          />
        </div>

        {/* Gradiente — topo leve, rodapé escuro para legibilidade */}
        <div className="absolute inset-0 bg-gradient-to-b
          from-black/25
          via-black/10
          to-black/85"
        />

        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col min-h-screen px-6">

          {/* Logo */}
          <header className="pt-14 pb-4">
            <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase">
              THAIXSKILL
            </span>
          </header>

          {/* Texto + botões — ancorados na parte inferior */}
          <main className="flex-1 flex flex-col justify-end pb-10">
            <div className="space-y-4 mb-8">
              <h1 className="text-4xl font-extrabold leading-tight text-white drop-shadow-sm">
                Destrave os skills do CrossFit.{' '}
                <em className="text-primary not-italic">NO SEU RITMO.</em>
              </h1>
              <p className="text-white/80 text-base leading-relaxed">
                O complemento da sua box: pull-up, toes-to-bar,
                muscle-up, HSPU e mais — com a base que ninguém te ensina.
              </p>
            </div>

            <div className="space-y-3">
              <Link
                href="/signup"
                className="block w-full h-14 bg-primary text-white font-bold text-base rounded-full text-center leading-[56px] hover:bg-primary/90 transition-colors"
              >
                Começar
              </Link>
              <Link
                href="/login"
                className="block w-full text-center text-white/70 text-sm py-2 hover:text-white transition-colors"
              >
                Já tenho minha conta
              </Link>
            </div>
          </main>

        </div>
      </div>
    </div>
  )
}
