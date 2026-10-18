"use client";

import { useEffect, useState } from "react";
import { guardar } from "@/lib/candidaturas";
import { pasaFiltro, puntuar } from "@/lib/encaje";
import { db } from "@/lib/store";
import type { Encaje, Oferta, Perfil, Preferencias } from "@/lib/tipos";

export default function PaginaOfertas() {
  const [q, setQ] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [remoto, setRemoto] = useState(true);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [prefs, setPrefs] = useState<Preferencias | null>(null);
  const [encajes, setEncajes] = useState<Record<string, Encaje>>({});
  const [puntuando, setPuntuando] = useState(false);
  const [guardadas, setGuardadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    db.candidaturas
      .toCollection()
      .primaryKeys()
      .then((k) => setGuardadas(new Set(k)));
    db.perfil.get("perfil").then((p) => p && setPerfil(p));
    db.encajes.toArray().then((l) => setEncajes(Object.fromEntries(l.map((e) => [e.ofertaId, e]))));
    db.preferencias.get("preferencias").then((p) => {
      if (!p) return;
      setPrefs(p);
      setQ(p.puestos[0] ?? "");
      setUbicacion(p.ubicacion);
      setRemoto(p.remoto);
    });
    db.ofertas.toArray().then(setOfertas);
  }, []);

  const busca = async () => {
    setCargando(true);
    setAviso("");
    try {
      const params = new URLSearchParams({ q, ubicacion, remoto: remoto ? "1" : "0" });
      const r = await fetch(`/api/ofertas?${params}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.mensaje ?? "No se ha podido buscar.");
      await db.ofertas.bulkPut(d.ofertas);
      setOfertas(d.ofertas);
      if (d.fallos.length) setAviso(`No han respondido: ${d.fallos.join(", ")}.`);
      else if (!d.ofertas.length) setAviso("Sin resultados. Prueba con otro puesto.");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se ha podido buscar.");
    } finally {
      setCargando(false);
    }
  };

  // Una a una: la IA de la app tiene un límite por minuto y así un fallo no pierde lo ya puntuado.
  const puntua = async (lista: Oferta[]) => {
    if (!perfil || !prefs) return;
    setPuntuando(true);
    setAviso("");
    try {
      const ajustes = (await db.ajustes.get("ajustes")) ?? {
        id: "ajustes" as const,
        modoIa: "app" as const,
      };
      for (const o of lista) {
        const e = await puntuar(o, perfil, prefs, ajustes);
        await db.encajes.put(e);
        setEncajes((previos) => ({ ...previos, [o.id]: e }));
      }
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se ha podido puntuar.");
    } finally {
      setPuntuando(false);
    }
  };

  const visibles = (prefs ? ofertas.filter((o) => pasaFiltro(o, prefs)) : [...ofertas]).sort(
    (a, b) => (encajes[b.id]?.nota ?? -1) - (encajes[a.id]?.nota ?? -1),
  );
  const sinPuntuar = visibles.filter((o) => !encajes[o.id]);

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h1 className="text-2xl font-bold">Buscar ofertas</h1>
        <label className="block">
          Puesto
          <input className="campo" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="block">
          Ubicación
          <input
            className="campo"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
          />
        </label>
        <label className="flex gap-2">
          <input type="checkbox" checked={remoto} onChange={(e) => setRemoto(e.target.checked)} />
          Incluir ofertas remotas
        </label>
        <button className="boton" disabled={cargando || !q.trim()} onClick={busca}>
          {cargando ? "Buscando…" : "Buscar"}
        </button>
        {aviso && <p className="bg-warn-soft text-warn rounded-lg p-3">{aviso}</p>}
      </section>

      {visibles.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            className="boton-sec"
            disabled={puntuando || !perfil || !prefs || sinPuntuar.length === 0}
            onClick={() => puntua(sinPuntuar)}
          >
            {puntuando ? "Puntuando…" : `Puntuar ${sinPuntuar.length} con la IA`}
          </button>
          {!perfil && <span className="text-muted">Primero sube tu CV en Perfil.</span>}
        </div>
      )}

      <ul className="space-y-3">
        {visibles.map((o) => (
          <li key={o.id} className="card space-y-1">
            <a
              href={o.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent font-bold"
            >
              {o.titulo}
            </a>
            <p className="text-muted">
              {o.empresa} · {o.ubicacion}
              {o.salario ? ` · ${o.salario}` : ""} <span className="chip">{o.fuente}</span>
            </p>
            {encajes[o.id] && (
              <div className="bg-accent-soft rounded-lg p-3 text-sm">
                <b>Encaje: {encajes[o.id].nota}/100</b>
                {encajes[o.id].cumple.length > 0 && (
                  <p className="text-ok">Cumples: {encajes[o.id].cumple.join("; ")}</p>
                )}
                {encajes[o.id].falta.length > 0 && (
                  <p className="text-bad">Te falta: {encajes[o.id].falta.join("; ")}</p>
                )}
              </div>
            )}
            <p className="line-clamp-3 text-sm">{o.descripcion}</p>
            <button
              className="boton-sec"
              disabled={guardadas.has(o.id)}
              onClick={async () => {
                await guardar(db, o.id);
                setGuardadas((g) => new Set(g).add(o.id));
              }}
            >
              {guardadas.has(o.id) ? "Guardada" : "Guardar"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
