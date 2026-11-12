"use client";

import type { Almacenamiento } from "@/lib/almacen/tipos";
import { useConsulta } from "@/lib/useConsulta.ts";

const modoDemo = async (almacen: Almacenamiento) =>
  (await almacen.leerAjustes())?.modoIa === "demo";

export function AvisoDemo() {
  const demo = useConsulta(modoDemo);
  if (!demo) return null;
  return (
    <p className="bg-warn-soft text-warn px-4 py-2 text-center text-sm">
      Modo demo: los datos y las notas son de ejemplo. Cámbialo en Ajustes para usar una IA real.
    </p>
  );
}
