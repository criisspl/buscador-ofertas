"use client";

import { useCallback, useEffect, useState } from "react";
import { actualizar, cartaPara, ESTADOS, exportar, importar } from "@/lib/candidaturas";
import { db } from "@/lib/store";
import type { Candidatura, Oferta, Perfil } from "@/lib/tipos";

interface Fila {
  c: Candidatura;
  o?: Oferta;
}

async function leeFilas(): Promise<Fila[]> {
  const cs = await db.candidaturas.orderBy("actualizada").reverse().toArray();
  const os = await db.ofertas.bulkGet(cs.map((c) => c.ofertaId));
  return cs.map((c, i) => ({ c, o: os[i] }));
}

export default function PaginaCandidaturas() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [aviso, setAviso] = useState("");
  const [generando, setGenerando] = useState("");

  const carga = useCallback(() => leeFilas().then(setFilas), []);

  useEffect(() => {
    leeFilas().then(setFilas);
    db.perfil.get("perfil").then((p) => p && setPerfil(p));
  }, []);

  const cambia = async (
    id: string,
    cambios: Partial<Pick<Candidatura, "estado" | "notas" | "carta">>,
  ) => {
    await actualizar(db, id, cambios);
    await carga();
  };

  const generaCarta = async (o: Oferta) => {
    if (!perfil) return;
    setGenerando(o.id);
    setAviso("");
    try {
      const ajustes = (await db.ajustes.get("ajustes")) ?? {
        id: "ajustes" as const,
        modoIa: "app" as const,
      };
      await cambia(o.id, { carta: await cartaPara(o, perfil, ajustes) });
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se ha podido escribir la carta.");
    } finally {
      setGenerando("");
    }
  };

  const descarga = async () => {
    const url = URL.createObjectURL(new Blob([await exportar(db)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: "candidaturas.json",
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  const sube = async (f: File) => {
    try {
      const n = await importar(db, await f.text());
      setAviso(`Importadas ${n} candidaturas.`);
      await carga();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se ha podido importar.");
    }
  };

  return (
    <div className="space-y-4">
      <section className="card flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">Candidaturas</h1>
        <button className="boton-sec" onClick={descarga}>
          Exportar copia
        </button>
        <label className="boton-sec cursor-pointer">
          Importar copia
          <input
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && sube(e.target.files[0])}
          />
        </label>
        {aviso && <p className="bg-warn-soft text-warn w-full rounded-lg p-3">{aviso}</p>}
      </section>

      {filas.length === 0 && (
        <p className="card text-muted">
          Aún no has guardado ninguna oferta. Guárdalas desde Ofertas.
        </p>
      )}

      {filas.map(({ c, o }) => (
        <section key={c.ofertaId} className="card space-y-3">
          <div>
            {o ? (
              <a
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent font-bold"
              >
                {o.titulo}
              </a>
            ) : (
              <b>{c.ofertaId}</b>
            )}
            {o && (
              <p className="text-muted">
                {o.empresa} · {o.ubicacion}
              </p>
            )}
          </div>
          <label className="block">
            Estado
            <select
              className="campo"
              value={c.estado}
              onChange={(e) =>
                cambia(c.ofertaId, { estado: e.target.value as Candidatura["estado"] })
              }
            >
              {ESTADOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Notas
            <textarea
              className="campo"
              rows={2}
              defaultValue={c.notas}
              onBlur={(e) =>
                e.target.value !== c.notas && cambia(c.ofertaId, { notas: e.target.value })
              }
            />
          </label>
          <label className="block">
            Carta de presentación
            <textarea
              className="campo"
              rows={6}
              defaultValue={c.carta}
              key={c.carta}
              onBlur={(e) =>
                e.target.value !== c.carta && cambia(c.ofertaId, { carta: e.target.value })
              }
            />
          </label>
          {o && (
            <button
              className="boton-sec"
              disabled={!perfil || generando === o.id}
              onClick={() => generaCarta(o)}
            >
              {generando === o.id ? "Escribiendo…" : "Escribir carta con la IA"}
            </button>
          )}
          {!perfil && (
            <p className="text-muted text-sm">
              Para escribir la carta, primero sube tu CV en Perfil.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
