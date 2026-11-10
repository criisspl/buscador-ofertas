import type { Metadata } from "next";
import { PaginaOfertas } from "./_componentes/PaginaOfertas";

export const metadata: Metadata = { title: "Ofertas" };

export default function Page() {
  return <PaginaOfertas />;
}
