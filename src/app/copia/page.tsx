import type { Metadata } from "next";
import { PaginaCopia } from "./_componentes/PaginaCopia";

export const metadata: Metadata = { title: "Copia de seguridad" };

export default function Page() {
  return <PaginaCopia />;
}
