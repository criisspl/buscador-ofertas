import type { Metadata } from "next";
import { PaginaPerfil } from "./_componentes/PaginaPerfil";

export const metadata: Metadata = { title: "Perfil" };

export default function Page() {
  return <PaginaPerfil />;
}
