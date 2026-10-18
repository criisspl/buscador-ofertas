"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/store";
import type { Oferta } from "@/lib/tipos";

export default function PaginaOfertas() {
  const [q, setQ] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [remoto, setRemoto] = useState(true);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    db.preferencias.get("preferencias").then((p) => {
      if (!p) return;
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

      <ul className="space-y-3">
        {ofertas.map((o) => (
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
            <p className="line-clamp-3 text-sm">{o.descripcion}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
