"use client";

import { useRouter } from "next/navigation";
import { useAlmacen } from "@/lib/almacen/contexto";
import { cargarDemo } from "@/lib/demo-datos";

export function BotonDemo() {
  const router = useRouter();
  const almacen = useAlmacen();
  const prueba = async () => {
    if (
      (await almacen.hayDatos()) &&
      !confirm(
        "Esto sustituye tu perfil, tus preferencias y tus ajustes de IA por datos de ejemplo. ¿Seguir?",
      )
    )
      return;
    await cargarDemo(almacen);
    router.push("/ofertas");
  };
  return (
    <button className="boton-sec" onClick={prueba}>
      Probar con datos de ejemplo
    </button>
  );
}
