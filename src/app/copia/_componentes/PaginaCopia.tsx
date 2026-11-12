"use client";

import { useState } from "react";
import { useAlmacen } from "@/lib/almacen/contexto";
import { bajar, borrarCopia, subir } from "@/lib/nube/cliente";
import { marcarCopia } from "@/lib/recordatorio";

const MIN_PASSWORD = 10;

export function PaginaCopia() {
  const almacen = useAlmacen();
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  const ejecuta = async (accion: () => Promise<string>) => {
    setTrabajando(true);
    setMensaje(null);
    try {
      setMensaje({ ok: true, texto: await accion() });
    } catch (e) {
      setMensaje({ ok: false, texto: e instanceof Error ? e.message : "Algo ha fallado." });
    } finally {
      setTrabajando(false);
    }
  };

  const listo = alias.trim().length >= 3 && password.length > 0;
  const hora = (t: number) => new Date(t).toLocaleString("es");

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h1 className="text-2xl font-bold">Copia en la nube</h1>
        <p className="text-muted">
          Guarda una copia cifrada para recuperar tus datos si borras el navegador o cambias de
          dispositivo. Se cifra aquí, en tu navegador: el servidor solo guarda datos ilegibles y no
          puede leer nada. Tu clave de IA nunca se sube.
        </p>
        <p className="bg-warn-soft text-warn rounded-lg p-3">
          Si olvidas la contraseña no hay forma de recuperar la copia. Nadie puede restablecerla.
        </p>
        <label className="block">
          Alias
          <input
            className="campo"
            value={alias}
            autoComplete="off"
            onChange={(e) => setAlias(e.target.value)}
          />
        </label>
        <label className="block">
          Contraseña (mínimo {MIN_PASSWORD} caracteres para guardar)
          <input
            className="campo"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            className="boton"
            disabled={trabajando || !listo || password.length < MIN_PASSWORD}
            onClick={() =>
              ejecuta(async () => {
                const cuando = await subir(almacen, alias, password);
                marcarCopia(localStorage);
                return `Copia guardada (${hora(cuando)}).`;
              })
            }
          >
            Guardar copia
          </button>
          <button
            className="boton-sec"
            disabled={trabajando || !listo}
            onClick={() =>
              ejecuta(
                async () =>
                  `Datos recuperados (copia del ${hora(await bajar(almacen, alias, password))}).`,
              )
            }
          >
            Recuperar copia
          </button>
          <button
            className="boton-sec"
            disabled={trabajando || !listo}
            onClick={() =>
              ejecuta(async () => {
                if (!confirm("¿Borrar la copia de la nube? Tus datos locales no se tocan."))
                  return "Cancelado.";
                await borrarCopia(alias, password);
                return "Copia borrada.";
              })
            }
          >
            Borrar copia
          </button>
        </div>
        {trabajando && <p className="text-muted">Trabajando… puede tardar un par de segundos.</p>}
        {mensaje && (
          <p
            role="status"
            className={`rounded-lg p-3 ${mensaje.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}
          >
            {mensaje.texto}
          </p>
        )}
        <p className="text-muted text-sm">
          Recuperar añade y actualiza lo que haya en la copia; no borra lo que ya tienes aquí.
        </p>
      </section>
    </div>
  );
}
