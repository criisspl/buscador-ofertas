"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/perfil", texto: "Perfil" },
  { href: "/ofertas", texto: "Ofertas" },
  { href: "/candidaturas", texto: "Candidaturas" },
  { href: "/copia", texto: "Copia" },
  { href: "/ajustes", texto: "Ajustes" },
];

// Alto táctil mínimo de 44px (min-h-11).
const CLASE = "inline-flex min-h-11 items-center";

export function Nav() {
  const ruta = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 px-4"
    >
      <Link href="/" className={`${CLASE} font-bold`}>
        Buscador de ofertas
      </Link>
      {ENLACES.map(({ href, texto }) => {
        const activo = ruta === href || ruta.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            className={`${CLASE} ${activo ? "text-ink font-semibold underline" : "text-muted hover:text-ink"}`}
          >
            {texto}
          </Link>
        );
      })}
    </nav>
  );
}
