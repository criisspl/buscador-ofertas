"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  actualizar,
  borrar,
  cartaPara,
  contar,
  ESTADOS,
  exportar,
  filtrar,
  importar,
  nombreCarta,
  type Fila,
  type Filtro,
} from "@/lib/candidaturas";
import { db } from "@/lib/store";
import type { Candidatura, Oferta, Perfil } from "@/lib/tipos";

async function leeFilas(): Promise<Fila[]> {
  const cs = await db.candidaturas.orderBy("actualizada").reverse().toArray();
  const ids = cs.map((c) => c.ofertaId);
  const [os, es] = await Promise.all([db.ofertas.bulkGet(ids), db.encajes.bulkGet(ids)]);
  return cs.map((c, i) => ({ c, o: os[i], e: es[i] }));
}

export default function PaginaCandidaturas() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [aviso, setAviso] = useState("");
  const [generando, setGenerando] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("activas");
  const [busqueda, setBusqueda] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [copiada, setCopiada] = useState("");
  const [guardado, setGuardado] = useState("");
  const temporizadores = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

  const quita = async (id: string) => {
    clearTimeout(temporizadores.current[id]);
    await borrar(db, id);
    setConfirmar("");
    await carga();
  };

  const copia = async (id: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiada(id);
      setTimeout(() => setCopiada(""), 1600);
    } catch {
      setAviso("No se ha podido copiar. Selecciona el texto y cópialo a mano.");
    }
  };

  const descargaCarta = (o: Oferta | undefined, texto: string) => {
    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    Object.assign(document.createElement("a"), {
      href: url,
      download: nombreCarta(o?.empresa),
    }).click();
    URL.revokeObjectURL(url);
  };

  const escribeNota = (id: string, notas: string) => {
    clearTimeout(temporizadores.current[id]);
    setGuardado("");
    temporizadores.current[id] = setTimeout(async () => {
      await cambia(id, { notas });
      setGuardado(id);
    }, 700);
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

  const cuenta = contar(filas);
  const visibles = filtrar(filas, filtro, busqueda);
  const filtros: { id: Filtro; etiqueta: string }[] = [
    { id: "activas", etiqueta: "En marcha" },
    ...ESTADOS.filter((e) => cuenta[e.id] > 0).map((e) => ({ id: e.id, etiqueta: e.etiqueta })),
    { id: "todas", etiqueta: "Todas" },
  ];

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

      {filas.length > 0 && (
        <>
          <nav aria-label="Filtros" className="flex flex-wrap gap-2">
            {filtros.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filtro === f.id}
                className="boton-sec"
                onClick={() => setFiltro(f.id)}
              >
                {f.etiqueta} <b>{cuenta[f.id]}</b>
              </button>
            ))}
          </nav>
          <input
            type="search"
            className="campo"
            placeholder="Buscar empresa o puesto"
            aria-label="Buscar empresa o puesto"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {visibles.length === 0 && (
            <p className="card text-muted">
              No hay candidaturas con este filtro. Prueba con «Todas».
            </p>
          )}
        </>
      )}

      {visibles.map(({ c, o, e }) => (
        <details key={c.ofertaId} className="card group">
          <summary className="cursor-pointer list-none">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-muted text-sm font-semibold tracking-wide break-words uppercase">
                  {o?.empresa ?? "Oferta"}
                </p>
                <h2 className="text-lg font-bold break-words">{o?.titulo ?? c.ofertaId}</h2>
              </div>
              <span className="chip shrink-0 font-bold">
                {ESTADOS.find((s) => s.id === c.estado)?.etiqueta}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {e && <span className="chip">Encaje {e.nota}/100</span>}
              {o?.ubicacion && <span className="chip">{o.ubicacion}</span>}
              {o?.salario && <span className="chip">{o.salario}</span>}
              <span className="chip">
                Guardada el {new Date(c.creada).toLocaleDateString("es-ES")}
              </span>
              <span className="text-accent ml-auto text-sm font-semibold" aria-hidden>
                <span className="group-open:hidden">Ver detalle ▾</span>
                <span className="hidden group-open:inline">Ocultar ▴</span>
              </span>
            </div>
          </summary>
          <div className="space-y-3 pt-3">
            {o?.url && (
              <a
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent block font-bold"
              >
                Abrir la oferta
              </a>
            )}
            {e && e.cumple.length > 0 && (
              <p>
                <b>Por qué encaja:</b> {e.cumple.join(" · ")}
              </p>
            )}
            {e && e.falta.length > 0 && (
              <p>
                <b>Lo que falta:</b> {e.falta.join(" · ")}
              </p>
            )}
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
              <span className="flex justify-between">
                Notas
                {guardado === c.ofertaId && <span className="text-muted text-sm">Guardado</span>}
              </span>
              <textarea
                className="campo"
                rows={2}
                defaultValue={c.notas}
                onChange={(e) => escribeNota(c.ofertaId, e.target.value)}
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
            {c.carta && (
              <div className="flex flex-wrap gap-2">
                <button className="boton-sec" onClick={() => copia(c.ofertaId, c.carta)}>
                  {copiada === c.ofertaId ? "Copiada" : "Copiar carta"}
                </button>
                <button className="boton-sec" onClick={() => descargaCarta(o, c.carta)}>
                  Descargar carta (.txt)
                </button>
              </div>
            )}
            {o && (
              <button
                className="boton-sec"
                disabled={!perfil || generando === o.id}
                onClick={() => generaCarta(o)}
              >
                {generando === o.id ? "Escribiendo…" : "Escribir carta con la IA"}
              </button>
            )}
            {confirmar === c.ofertaId ? (
              <div className="flex flex-wrap items-center gap-2">
                <span>¿Quitar esta candidatura de tu lista?</span>
                <button className="boton-sec" onClick={() => quita(c.ofertaId)}>
                  Quitar
                </button>
                <button className="boton-sec" onClick={() => setConfirmar("")}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                className="text-bad self-start py-2 text-sm underline"
                onClick={() => setConfirmar(c.ofertaId)}
              >
                Quitar de la lista
              </button>
            )}
            {!perfil && (
              <p className="text-muted text-sm">
                Para escribir la carta, primero sube tu CV en Perfil.
              </p>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
