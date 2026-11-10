"use client";

import { db } from "@/lib/store";
import { useConsulta } from "@/lib/useConsulta.ts";

const modoDemo = async () => (await db.ajustes.get("ajustes"))?.modoIa === "demo";

export function AvisoDemo() {
  const demo = useConsulta(modoDemo);
  if (!demo) return null;
  return (
    <p className="bg-warn-soft text-warn px-4 py-2 text-center text-sm">
      Modo demo: los datos y las notas son de ejemplo. Cámbialo en Ajustes para usar una IA real.
    </p>
  );
}
