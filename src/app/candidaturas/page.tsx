import type { Metadata } from "next";
import { PaginaCandidaturas } from "./_componentes/PaginaCandidaturas";

export const metadata: Metadata = { title: "Candidaturas" };

export default function Page() {
  return <PaginaCandidaturas />;
}
