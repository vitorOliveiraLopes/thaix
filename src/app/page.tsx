import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-foreground flex flex-col relative overflow-hidden">

      {/* Fundo escuro com imagem da coach — simulado com gradiente até termos a foto */}
      <div className="absolute inset-0 bg-gradient-to-b from-foreground/60 via-foreground/20 to-foreground/95 z-10" />

      {/* Placeholder da foto hero — substitua por <Image> quando tiver o asset */}
      <div className="absolute inset-0 bg-[oklch(0.17_0_0)]">
        {/* <Image src="/hero-thaix.jpg" alt="Coach Thaix" fill className="object-cover object-top" priority /> */}
      </div>

      {/* Conteúdo */}
      <div className="relative z-20 flex flex-col min-h-screen max-w-sm mx-auto w-full px-6">

        {/* Logo */}
        <header className="pt-14 pb-4">
          <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase">
            THAIXSKILL
          </span>
        </header>

        {/* Hero text — empurrado para baixo */}
        <main className="flex-1 flex flex-col justify-end pb-10">
          <div className="space-y-4 mb-8">
            <h1 className="text-4xl font-extrabold leading-tight text-white">
              Destrave os skills do CrossFit.{' '}
              <em className="text-primary not-italic">NO SEU RITMO.</em>
            </h1>
            <p className="text-white/70 text-base leading-relaxed">
              O complemento da sua box: pull-up, toes-to-bar,
              muscle-up, HSPU e mais — com a base que ninguém te ensina.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/signup"
              className="block w-full h-14 bg-primary text-white font-bold text-base rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
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
  )
}
