import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <header className="px-6 pt-8 flex items-center justify-between max-w-md mx-auto w-full">
        <span className="font-semibold tracking-tight">ThaixSkill</span>
        <Link href="/login">
          <Button variant="ghost" size="sm">Entrar</Button>
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-md mx-auto w-full">
        <div className="space-y-6">

          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
              Calistenia · CrossFit · Skills
            </p>
            <h1 className="text-4xl font-semibold tracking-tight leading-tight">
              Treine com método.<br />Evolua de verdade.
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Um protocolo personalizado de 28 dias com a Coach Thais.
              Do iniciante ao muscle-up.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <Link href="/signup" className="w-full">
              <Button className="w-full h-12 text-base">
                Começar grátis por 7 dias
              </Button>
            </Link>
            <Link href="/login" className="w-full">
              <Button variant="outline" className="w-full h-12">
                Já tenho conta
              </Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            Sem cartão de crédito · Cancele quando quiser
          </p>

        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 pb-8 text-center">
        <p className="text-xs text-muted-foreground">
          © 2026 ThaixSkill · Todos os direitos reservados
        </p>
      </footer>

    </div>
  )
}