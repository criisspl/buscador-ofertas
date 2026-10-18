import type { Metadata } from "next";
import Link from "next/link";
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
          <nav className="mx-auto flex max-w-3xl items-center gap-5 px-4 py-3">
            <Link href="/" className="font-bold">
              Buscador de ofertas
            </Link>
            <Link href="/perfil" className="text-muted hover:text-ink">
              Perfil
            </Link>
            <Link href="/ajustes" className="text-muted hover:text-ink">
              Ajustes
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
