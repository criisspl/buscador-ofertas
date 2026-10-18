"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/store";

export function AvisoDemo() {
  const [demo, setDemo] = useState(false);
  // El layout no se recarga al navegar: se vuelve a mirar en cada cambio de página.
  const ruta = usePathname();
  useEffect(() => {
    db.ajustes.get("ajustes").then((a) => setDemo(a?.modoIa === "demo"));
  }, [ruta]);
  if (!demo) return null;
  return (
    <p className="bg-warn-soft text-warn px-4 py-2 text-center text-sm">
      Modo demo: los datos y las notas son de ejemplo. Cámbialo en Ajustes para usar una IA real.
    </p>
  );
}
