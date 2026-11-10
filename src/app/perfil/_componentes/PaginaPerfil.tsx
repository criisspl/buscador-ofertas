"use client";

import { useState } from "react";
import { ErrorCv, extraerTextoPdf } from "@/lib/cv/texto";
import { perfilDesdeCv } from "@/lib/cv/perfil";
import { ErrorIa } from "@/lib/ia/cliente";
import { db } from "@/lib/store";
import { useConsulta } from "@/lib/useConsulta.ts";
import type { Ajustes, Perfil, Preferencias } from "@/lib/tipos";

const PREFS: Preferencias = {
  id: "preferencias",
  puestos: [],
  ubicacion: "",
  remoto: true,
  sectoresEvitar: [],
};
const lista = (t: string) =>
  t
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const leePerfil = () => db.perfil.get("perfil");
const leePrefs = () => db.preferencias.get("preferencias");

export function PaginaPerfil() {
  // Lo guardado llega de Dexie; `*Editad*` guarda lo que la persona va tocando sin guardar.
  const guardadoPerfil = useConsulta(leePerfil);
  const guardadoPrefs = useConsulta(leePrefs);
  const [perfilEditado, setPerfil] = useState<Perfil | null>(null);
  const [prefsEditadas, setPrefs] = useState<Preferencias | null>(null);
  const perfil = perfilEditado ?? guardadoPerfil ?? null;
  const prefs = prefsEditadas ?? guardadoPrefs ?? PREFS;
  const [textoPendiente, setTextoPendiente] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);

  const leePdf = async (f: File) => {
    setError("");
    try {
      if (f.type !== "application/pdf") throw new ErrorCv("tipo", "Sube un PDF.");
      setTextoPendiente(await extraerTextoPdf(await f.arrayBuffer()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido leer el CV.");
    }
  };

  // Solo se envía el texto a la IA después de que la persona lo acepte.
  const generaPerfil = async () => {
    if (!textoPendiente) return;
    setCargando(true);
    setError("");
    try {
      const aj: Ajustes = (await db.ajustes.get("ajustes")) ?? { id: "ajustes", modoIa: "app" };
      setPerfil(await perfilDesdeCv(textoPendiente, aj));
      setTextoPendiente(null);
    } catch (e) {
      setError(e instanceof ErrorIa || e instanceof Error ? e.message : "Algo ha fallado.");
    } finally {
      setCargando(false);
    }
  };

  const guarda = async () => {
    if (perfil) await db.perfil.put(perfil);
    await db.preferencias.put(prefs);
    setGuardado(true);
  };

  const cambiaPerfil = (p: Partial<Perfil>) => {
    if (perfil) setPerfil({ ...perfil, ...p });
    setGuardado(false);
  };
  const cambiaPrefs = (p: Partial<Preferencias>) => {
    setPrefs({ ...prefs, ...p });
    setGuardado(false);
  };

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h1 className="text-2xl font-bold">Tu CV</h1>
        <input
          type="file"
          className="w-full"
          accept="application/pdf"
          aria-label="Subir CV en PDF"
          onChange={(e) => e.target.files?.[0] && leePdf(e.target.files[0])}
        />
        {textoPendiente && (
          <div className="bg-warn-soft text-warn space-y-2 rounded-lg p-3">
            <p>
              El texto de tu CV se enviará a la IA para sacar tu perfil. Si usas la IA de la app,
              pasa por el servidor sin guardarse. ¿Seguimos?
            </p>
            <button className="boton" disabled={cargando} onClick={generaPerfil}>
              {cargando ? "Leyendo…" : "Sí, generar perfil"}
            </button>
          </div>
        )}
        {error && <p className="bg-bad-soft text-bad rounded-lg p-3">{error}</p>}
      </section>

      {perfil && (
        <section className="card space-y-3">
          <h2 className="text-xl font-bold">Revisa tu perfil</h2>
          <label className="block">
            Habilidades (separadas por comas)
            <input
              className="campo"
              value={perfil.skills.join(", ")}
              onChange={(e) => cambiaPerfil({ skills: lista(e.target.value) })}
            />
          </label>
          <label className="block">
            Idiomas
            <input
              className="campo"
              value={perfil.idiomas.join(", ")}
              onChange={(e) => cambiaPerfil({ idiomas: lista(e.target.value) })}
            />
          </label>
          <ul className="text-muted list-disc pl-5">
            {perfil.experiencia.map((x, i) => (
              <li key={i}>
                {x.puesto} · {x.empresa}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="text-xl font-bold">Qué buscas</h2>
        <label className="block">
          Puestos (separados por comas)
          <input
            className="campo"
            value={prefs.puestos.join(", ")}
            onChange={(e) => cambiaPrefs({ puestos: lista(e.target.value) })}
          />
        </label>
        <label className="block">
          Ubicación
          <input
            className="campo"
            value={prefs.ubicacion}
            onChange={(e) => cambiaPrefs({ ubicacion: e.target.value })}
          />
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={prefs.remoto}
            onChange={(e) => cambiaPrefs({ remoto: e.target.checked })}
          />
          Acepto trabajo remoto
        </label>
        <label className="block">
          Salario mínimo anual (opcional)
          <input
            className="campo"
            type="number"
            min={0}
            value={prefs.salarioMinimo ?? ""}
            onChange={(e) =>
              cambiaPrefs({ salarioMinimo: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </label>
        <label className="block">
          Sectores a evitar
          <input
            className="campo"
            value={prefs.sectoresEvitar.join(", ")}
            onChange={(e) => cambiaPrefs({ sectoresEvitar: lista(e.target.value) })}
          />
        </label>
        <div className="flex items-center gap-3">
          <button className="boton" onClick={guarda}>
            Guardar
          </button>
          <span role="status" className="text-ok">
            {guardado && "Guardado"}
          </span>
        </div>
      </section>
    </div>
  );
}
