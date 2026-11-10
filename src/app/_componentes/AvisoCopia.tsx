"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { hayDatos } from "@/lib/demo-datos";
import { pedirPersistencia, posponer, tocaRecordar } from "@/lib/recordatorio";
import { db } from "@/lib/store";
import { useConsulta } from "@/lib/useConsulta.ts";

const hayAlgoQuePerder = async () => {
  const demo = (await db.ajustes.get("ajustes"))?.modoIa === "demo";
  return !demo && (await hayDatos(db));
};

// Las fechas viven en localStorage, que no avisa de cambios: se vuelve a mirar en cada render.
const tocaAhora = (datos: boolean) => {
  try {
    return tocaRecordar(localStorage, datos);
  } catch {
    return false;
  }
};

export function AvisoCopia() {
  const datos = useConsulta(hayAlgoQuePerder) ?? false;
  const [pospuesto, setPospuesto] = useState(false);
  // El layout no se recarga al navegar: la ruta hace que se vuelva a evaluar.
  const ruta = usePathname();

  // Solo se pide la persistencia cuando ya hay algo que perder.
  useEffect(() => {
    if (datos) void pedirPersistencia();
  }, [datos]);

  const toca = datos && !pospuesto && tocaAhora(datos);
  if (!toca || ruta === "/copia" || ruta === "/candidaturas") return null;
  return (
    <p className="bg-warn-soft text-warn flex flex-wrap items-center justify-center gap-3 px-4 py-2 text-center text-sm">
      Tus datos solo están en este navegador y hace tiempo que no haces copia.
      <Link href="/copia" className="font-bold underline">
        Hacer copia
      </Link>
      <button
        className="underline"
        onClick={() => {
          posponer(localStorage);
          setPospuesto(true);
        }}
      >
        Ahora no
      </button>
    </p>
  );
}
