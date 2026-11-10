import type { Metadata } from "next";
import { PaginaAjustes } from "./_componentes/PaginaAjustes";

export const metadata: Metadata = { title: "Ajustes" };

export default function Page() {
  return <PaginaAjustes />;
}
