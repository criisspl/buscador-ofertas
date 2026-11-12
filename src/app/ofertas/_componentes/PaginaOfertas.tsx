"use client";

import { useState } from "react";
import { useAlmacen } from "@/lib/almacen/contexto";
import type { Almacenamiento } from "@/lib/almacen/tipos";
import { proveedorActual } from "@/lib/ia/actual";
import { guardar } from "@/lib/candidaturas";
import { pasaFiltro, puntuar } from "@/lib/encaje";
import type { Encaje, Oferta } from "@/lib/tipos";
import { useConsulta } from "@/lib/useConsulta.ts";

const leeOfertas = (a: Almacenamiento) => a.listarOfertas();
const leePerfil = (a: Almacenamiento) => a.leerPerfil();
const leePrefs = (a: Almacenamiento) => a.leerPreferencias();
const leeEncajes = async (a: Almacenamiento) => {
  const l = await a.listarEncajes();
  return Object.fromEntries(l.map((e) => [e.ofertaId, e])) as Record<string, Encaje>;
};
const leeGuardadas = async (a: Almacenamiento) => new Set(await a.idsCandidaturas());

export function PaginaOfertas() {
  const almacen = useAlmacen();
  const almacenadas = useConsulta(leeOfertas);
  const perfil = useConsulta(leePerfil) ?? null;
  const prefs = useConsulta(leePrefs) ?? null;
  const encajes = useConsulta(leeEncajes) ?? {};
  const guardadas = useConsulta(leeGuardadas) ?? new Set<string>();
  // Mientras la persona no toca el formulario, se usan las preferencias guardadas.
  const [qEditado, setQ] = useState<string | null>(null);
  const [ubicacionEditada, setUbicacion] = useState<string | null>(null);
  const [remotoEditado, setRemoto] = useState<boolean | null>(null);
  const q = qEditado ?? prefs?.puestos[0] ?? "";
  const ubicacion = ubicacionEditada ?? prefs?.ubicacion ?? "";
  const remoto = remotoEditado ?? prefs?.remoto ?? true;
  // Tras una búsqueda se enseñan solo sus resultados (y lo que se añada después).
  const [idsMostrados, setIdsMostrados] = useState<Set<string> | null>(null);
  const ofertas = (almacenadas ?? []).filter((o) => !idsMostrados || idsMostrados.has(o.id));
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [puntuando, setPuntuando] = useState(false);
  const [enlace, setEnlace] = useState("");
  const [importando, setImportando] = useState(false);
  const [avisoImporta, setAvisoImporta] = useState("");
  const [avisoLimpieza, setAvisoLimpieza] = useState("");
  const [manual, setManual] = useState(false);
  const [mano, setMano] = useState({ titulo: "", empresa: "", url: "", descripcion: "" });

  const busca = async () => {
    setCargando(true);
    setAviso("");
    try {
      const params = new URLSearchParams({ q, ubicacion, remoto: remoto ? "1" : "0" });
      const r = await fetch(`/api/ofertas?${params}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.mensaje ?? "No se ha podido buscar.");
      await almacen.guardarOfertas(d.ofertas);
      setIdsMostrados(new Set(d.ofertas.map((x: Oferta) => x.id)));
      if (d.fallos.length) setAviso(`No han respondido: ${d.fallos.join(", ")}.`);
      else if (!d.ofertas.length) setAviso("Sin resultados. Prueba con otro puesto.");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se ha podido buscar.");
    } finally {
      setCargando(false);
    }
  };

  const añade = async (o: Oferta) => {
    await almacen.guardarOferta(o);
    setIdsMostrados((ids) => ids && new Set(ids).add(o.id));
  };

  const importa = async () => {
    setImportando(true);
    setAvisoImporta("");
    try {
      const r = await fetch("/api/importar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: enlace.trim() }),
      });
      const d = await r.json();
      if (!r.ok) {
        setManual(true);
        throw new Error(d.mensaje ?? "No se ha podido importar.");
      }
      await añade(d.oferta);
      setEnlace("");
      setAvisoImporta(`Añadida: ${d.oferta.titulo}`);
    } catch (e) {
      setAvisoImporta(e instanceof Error ? e.message : "No se ha podido importar.");
    } finally {
      setImportando(false);
    }
  };

  const guardaMano = async () => {
    const url = mano.url.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      setAvisoImporta("El enlace tiene que empezar por http o https.");
      return;
    }
    const id = `mano:${crypto.randomUUID()}`;
    await añade({
      id,
      fuente: "manual",
      idExterno: id,
      titulo: mano.titulo.trim(),
      empresa: mano.empresa.trim(),
      ubicacion: "",
      url,
      descripcion: mano.descripcion.trim().slice(0, 1500),
    });
    setMano({ titulo: "", empresa: "", url: "", descripcion: "" });
    setManual(false);
    setAvisoImporta("Oferta añadida.");
  };

  // Una a una: la IA de la app tiene un límite por minuto y así un fallo no pierde lo ya puntuado.
  const puntua = async (lista: Oferta[]) => {
    if (!perfil || !prefs) return;
    setPuntuando(true);
    setAviso("");
    try {
      const ia = await proveedorActual(almacen);
      for (const o of lista) {
        const e = await puntuar(o, perfil, prefs, ia);
        await almacen.guardarEncaje(e);
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
  const sinGuardar = (almacenadas ?? []).filter((o) => !guardadas.has(o.id)).length;

  const limpia = async () => {
    if (!confirm(`¿Borrar ${sinGuardar} ofertas no guardadas? Las guardadas no se tocan.`)) return;
    const n = await almacen.borrarOfertasNoGuardadas();
    setAvisoLimpieza(`Se han borrado ${n} ofertas`);
  };

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h1 className="text-2xl font-bold">Buscar ofertas</h1>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!cargando && q.trim()) void busca();
          }}
        >
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
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={remoto} onChange={(e) => setRemoto(e.target.checked)} />
            Incluir ofertas remotas
          </label>
          <button className="boton" type="submit" disabled={cargando || !q.trim()}>
            {cargando ? "Buscando…" : "Buscar"}
          </button>
        </form>
        {aviso && (
          <p role="status" className="bg-warn-soft text-warn rounded-lg p-3">
            {aviso}
          </p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">Añadir una oferta</h2>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!importando && enlace.trim()) void importa();
          }}
        >
          <label className="block">
            Enlace de la oferta
            <input
              className="campo"
              type="url"
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <div className="flex gap-3">
            <button className="boton" type="submit" disabled={importando || !enlace.trim()}>
              {importando ? "Importando…" : "Importar"}
            </button>
            <button className="boton-sec" type="button" onClick={() => setManual((m) => !m)}>
              Añadir a mano
            </button>
          </div>
        </form>
        {avisoImporta && (
          <p role="status" className="bg-warn-soft text-warn rounded-lg p-3">
            {avisoImporta}
          </p>
        )}
        {manual && (
          <div className="space-y-3">
            {(["titulo", "empresa", "url"] as const).map((k) => (
              <label key={k} className="block">
                {k === "titulo" ? "Puesto" : k === "empresa" ? "Empresa" : "Enlace (opcional)"}
                <input
                  className="campo"
                  value={mano[k]}
                  onChange={(e) => setMano({ ...mano, [k]: e.target.value })}
                />
              </label>
            ))}
            <label className="block">
              Descripción
              <textarea
                className="campo"
                rows={5}
                value={mano.descripcion}
                onChange={(e) => setMano({ ...mano, descripcion: e.target.value })}
              />
            </label>
            <button
              className="boton"
              disabled={!mano.titulo.trim() || mano.descripcion.trim().length < 30}
              onClick={guardaMano}
            >
              Guardar oferta
            </button>
          </div>
        )}
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

      {(sinGuardar > 0 || avisoLimpieza) && (
        <div className="space-y-3">
          {sinGuardar > 0 && (
            <button className="boton-sec" onClick={limpia}>
              Borrar ofertas no guardadas
            </button>
          )}
          {avisoLimpieza && (
            <p role="status" className="bg-warn-soft text-warn rounded-lg p-3">
              {avisoLimpieza}
            </p>
          )}
        </div>
      )}

      <ul className="space-y-3">
        {visibles.map((o) => (
          <li key={o.id} className="card space-y-1">
            {o.url ? (
              <a
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent font-bold"
              >
                {o.titulo}
              </a>
            ) : (
              <b>{o.titulo}</b>
            )}
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
                await guardar(almacen, o.id);
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
