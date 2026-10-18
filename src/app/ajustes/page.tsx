"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/store";
import type { Ajustes } from "@/lib/tipos";

const VACIOS: Ajustes = { id: "ajustes", modoIa: "app" };

export default function PaginaAjustes() {
  const [aj, setAj] = useState<Ajustes>(VACIOS);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    db.ajustes.get("ajustes").then((a) => a && setAj(a));
  }, []);

  const cambia = (parcial: Partial<Ajustes>) => {
    setAj({ ...aj, ...parcial });
    setGuardado(false);
  };

  const guarda = async () => {
    await db.ajustes.put(aj);
    setGuardado(true);
  };

  return (
    <div className="card space-y-4">
      <h1 className="text-2xl font-bold">Ajustes de IA</h1>
      <p className="text-muted">
        La IA es necesaria para leer tu CV y puntuar ofertas. Elige cómo usarla.
      </p>

      <label className="flex gap-2">
        <input
          type="radio"
          checked={aj.modoIa === "app"}
          onChange={() => cambia({ modoIa: "app" })}
        />
        <span>
          <b>IA de la app</b>: el texto pasa por el servidor, que no guarda nada.
        </span>
      </label>
      <label className="flex gap-2">
        <input
          type="radio"
          checked={aj.modoIa === "propia"}
          onChange={() => cambia({ modoIa: "propia" })}
        />
        <span>
          <b>Mi propia clave</b>: se guarda solo en este navegador y las llamadas van directas a tu
          proveedor.
        </span>
      </label>

      {aj.modoIa === "propia" && (
        <div className="space-y-3">
          <label className="block">
            URL (compatible con OpenAI)
            <input
              className="campo"
              placeholder="https://api.openai.com/v1/chat/completions"
              value={aj.url ?? ""}
              onChange={(e) => cambia({ url: e.target.value })}
            />
          </label>
          <label className="block">
            Modelo
            <input
              className="campo"
              value={aj.modelo ?? ""}
              onChange={(e) => cambia({ modelo: e.target.value })}
            />
          </label>
          <label className="block">
            Clave
            <input
              className="campo"
              type="password"
              autoComplete="off"
              value={aj.clave ?? ""}
              onChange={(e) => cambia({ clave: e.target.value })}
            />
          </label>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button className="boton" onClick={guarda}>
          Guardar
        </button>
        {guardado && <span className="text-ok">Guardado</span>}
      </div>
    </div>
  );
}
