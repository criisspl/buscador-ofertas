import type { Metadata } from "next";
import { ProveedorAlmacen } from "@/lib/almacen/contexto";
import { AvisoCopia } from "./_componentes/AvisoCopia";
import { Nav } from "./_componentes/Nav";
import { AvisoDemo } from "./_componentes/AvisoDemo";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Buscador de ofertas", template: "%s · Buscador de ofertas" },
  description:
    "Encuentra ofertas de trabajo según tu CV y tus preferencias. Tus datos se quedan en tu navegador.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">
        <ProveedorAlmacen>
          <header className="border-line bg-surface border-b">
            <Nav />
          </header>
          <AvisoDemo />
          <AvisoCopia />
          <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
        </ProveedorAlmacen>
      </body>
    </html>
  );
}
