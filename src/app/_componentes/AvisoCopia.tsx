"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { hayDatos } from "@/lib/demo-datos";
import { pedirPersistencia, posponer, tocaRecordar } from "@/lib/recordatorio";
import { db } from "@/lib/store";

export function AvisoCopia() {
  const [toca, setToca] = useState(false);
  // El layout no se recarga al navegar: se vuelve a mirar en cada cambio de página.
  const ruta = usePathname();
  useEffect(() => {
    (async () => {
      const demo = (await db.ajustes.get("ajustes"))?.modoIa === "demo";
      const datos = !demo && (await hayDatos(db));
      // Solo se pide la persistencia cuando ya hay algo que perder.
      if (datos) void pedirPersistencia();
      try {
        setToca(tocaRecordar(localStorage, datos));
      } catch {
        setToca(false);
      }
    })();
  }, [ruta]);

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
          setToca(false);
        }}
      >
        Ahora no
      </button>
    </p>
  );
}
