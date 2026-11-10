import type { Metadata } from "next";
import Link from "next/link";
import { AvisoCopia } from "./_componentes/AvisoCopia";
import { AvisoDemo } from "./_componentes/AvisoDemo";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buscador de ofertas",
  description:
    "Encuentra ofertas de trabajo según tu CV y tus preferencias. Tus datos se quedan en tu navegador.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">
        <header className="border-line bg-surface border-b">
          <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3">
            <Link href="/" className="font-bold">
              Buscador de ofertas
            </Link>
            <Link href="/perfil" className="text-muted hover:text-ink">
              Perfil
            </Link>
            <Link href="/ofertas" className="text-muted hover:text-ink">
              Ofertas
            </Link>
            <Link href="/candidaturas" className="text-muted hover:text-ink">
              Candidaturas
            </Link>
            <Link href="/copia" className="text-muted hover:text-ink">
              Copia
            </Link>
            <Link href="/ajustes" className="text-muted hover:text-ink">
              Ajustes
            </Link>
          </nav>
        </header>
        <AvisoDemo />
        <AvisoCopia />
        <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
