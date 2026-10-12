import { redirect } from 'next/navigation'

/**
 * Este projeto é só a API do ThaixSkill. Quem abrir o endereço no navegador
 * vai para o app (WEB_APP_URL); sem ele configurado, vê um aviso simples.
 */
// Lido a cada acesso: mudar WEB_APP_URL na Vercel não exige novo deploy.
export const dynamic = 'force-dynamic'

export default function Home() {
  const app = process.env.WEB_APP_URL
  if (app) redirect(app)
  return (
    <main style={{ padding: 32 }}>
      <h1>ThaixSkill API</h1>
      <p>O app fica em outro endereço.</p>
    </main>
  )
}
