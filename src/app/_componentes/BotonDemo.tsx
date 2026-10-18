"use client";

import { useRouter } from "next/navigation";
import { cargarDemo, hayDatos } from "@/lib/demo-datos";
import { db } from "@/lib/store";

export function BotonDemo() {
  const router = useRouter();
  const prueba = async () => {
    if (
      (await hayDatos(db)) &&
      !confirm(
        "Esto sustituye tu perfil, tus preferencias y tus ajustes de IA por datos de ejemplo. ¿Seguir?",
      )
    )
      return;
    await cargarDemo(db);
    router.push("/ofertas");
  };
  return (
    <button className="boton-sec" onClick={prueba}>
      Probar con datos de ejemplo
    </button>
  );
}
