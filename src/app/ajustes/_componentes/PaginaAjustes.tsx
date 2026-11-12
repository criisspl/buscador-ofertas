"use client";

import { useEffect, useState } from "react";
import { ajustesPropiaSugerida, ajustesSugeridos } from "@/lib/ajustes";
import { OPCIONES_ALMACENAMIENTO } from "@/lib/almacen/opciones";
import { useAlmacen } from "@/lib/almacen/contexto";
import {
  bloquear,
  cifrarClave,
  claveDesbloqueada,
  desbloquear,
  descifrarClave,
  MIN_PASSWORD,
} from "@/lib/ia/clave";
import { ID_PRESETS, PRESETS } from "@/lib/ia/presets";
import { probarConexion, type ResultadoPrueba } from "@/lib/ia/prueba";
import { errorDeUrl, esLocal } from "@/lib/ia/url";
import { MigrarAlmacen } from "./MigrarAlmacen";
import type { Ajustes, ProveedorIaId, TipoAlmacenamiento } from "@/lib/tipos";

type Vista = "cargando" | "asistente" | "formulario";

export function PaginaAjustes() {
  const almacen = useAlmacen();
  const [aj, setAj] = useState<Ajustes>(ajustesSugeridos);
  const [vista, setVista] = useState<Vista>("cargando");
  const [guardado, setGuardado] = useState(false);
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState<ResultadoPrueba | null>(null);
  const [error, setError] = useState("");
  // Solo en memoria de este componente: la clave escrita y la contraseña que la protege.
  const [claveNueva, setClaveNueva] = useState("");
  const [password, setPassword] = useState("");
  const [desbloqueada, setDesbloqueada] = useState(() => !!claveDesbloqueada());
  const [passwordDesbloqueo, setPasswordDesbloqueo] = useState("");

  useEffect(() => {
    almacen.leerAjustes().then((a) => {
      if (a) setAj(a);
      setVista(a?.configurado ? "formulario" : "asistente");
    });
  }, [almacen]);

  const cambia = (parcial: Partial<Ajustes>) => {
    setAj({ ...aj, ...parcial });
    setGuardado(false);
    setPrueba(null);
    setError("");
  };

  const eligeProveedor = (id: ProveedorIaId) =>
    cambia({
      proveedorIa: id,
      url: PRESETS[id].url || undefined,
      modelo: PRESETS[id].modelo || undefined,
    });

  const sinClave = esLocal(aj.url);
  const clavePendiente = aj.clave && !aj.claveCifrada; // heredada en claro, sin proteger
  const hayClave = !!(claveNueva || aj.claveCifrada || aj.clave);

  const usaSugerida = async () => {
    const sugerida: Ajustes = { ...ajustesSugeridos(), configurado: true };
    await almacen.guardarAjustes(sugerida);
    setAj(sugerida);
    setVista("formulario");
    setGuardado(true);
  };

  const personaliza = () => {
    setAj(ajustesPropiaSugerida());
    setVista("formulario");
  };

  const guarda = async () => {
    const siguiente: Ajustes = { ...aj, configurado: true };
    if (siguiente.modoIa === "propia") {
      if (!siguiente.url || !siguiente.modelo)
        return setError("Faltan la dirección y el modelo de tu IA.");
      const motivo = errorDeUrl(siguiente.url);
      if (motivo) return setError(motivo);
      const clave = claveNueva || siguiente.clave;
      if (clave) {
        if (password.length < MIN_PASSWORD)
          return setError(
            `Escribe una contraseña de al menos ${MIN_PASSWORD} caracteres para proteger tu clave: se guarda cifrada con ella.`,
          );
        siguiente.claveCifrada = await cifrarClave(clave, password);
        delete siguiente.clave;
        desbloquear(clave);
        setDesbloqueada(true);
      } else if (!siguiente.claveCifrada && !esLocal(siguiente.url)) {
        return setError("Falta la clave de tu proveedor.");
      }
    }
    await almacen.guardarAjustes(siguiente);
    setAj(siguiente);
    setClaveNueva("");
    setPassword("");
    setGuardado(true);
    setError("");
  };

  const desbloquea = async () => {
    if (!aj.claveCifrada) return;
    try {
      desbloquear(await descifrarClave(aj.claveCifrada, passwordDesbloqueo));
      setDesbloqueada(true);
      setPasswordDesbloqueo("");
      setError("");
    } catch {
      setError("Contraseña incorrecta.");
    }
  };

  const olvida = () => {
    bloquear();
    setDesbloqueada(false);
  };

  const pruebaAhora = async () => {
    setProbando(true);
    setPrueba(null);
    try {
      setPrueba(await probarConexion(aj, claveNueva || claveDesbloqueada()));
    } catch {
      setPrueba({ ok: false, mensaje: "No se ha podido hacer la prueba." });
    } finally {
      setProbando(false);
    }
  };

  if (vista === "cargando") return <div className="card" />;

  if (vista === "asistente")
    return (
      <div className="card space-y-4">
        <h1 className="text-2xl font-bold">Configura tu app</h1>
        <p className="text-muted">
          Tú decides dónde se guardan tus datos y qué IA usas. Te sugerimos una configuración que
          funciona sin más pasos; puedes cambiarla cuando quieras.
        </p>
        <div className="bg-accent-soft space-y-1 rounded-lg p-4">
          <h2 className="font-semibold">Configuración sugerida</h2>
          <ul className="list-disc pl-5">
            <li>Datos: en este navegador (IndexedDB).</li>
            <li>IA: la de la app, el texto pasa por el servidor, que no guarda nada.</li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="boton" onClick={usaSugerida}>
            Usar la configuración sugerida
          </button>
          <button className="boton-sec" onClick={personaliza}>
            Personalizar
          </button>
        </div>
      </div>
    );

  return (
    <div className="card space-y-4">
      <h1 className="text-2xl font-bold">Ajustes</h1>
      <p className="text-muted">
        La IA es necesaria para leer tu CV y puntuar ofertas. Elige dónde guardar tus datos y cómo
        usar la IA.
      </p>

      <label className="block">
        Almacenamiento
        <select
          className="campo"
          value={aj.almacenamiento}
          onChange={(e) => cambia({ almacenamiento: e.target.value as TipoAlmacenamiento })}
        >
          {OPCIONES_ALMACENAMIENTO.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-semibold">Modo de IA</legend>
        <label className="flex gap-2">
          <input
            type="radio"
            name="modoIa"
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
            name="modoIa"
            checked={aj.modoIa === "propia"}
            onChange={() =>
              aj.url ? cambia({ modoIa: "propia" }) : cambia(ajustesPropiaSugerida(aj.proveedorIa))
            }
          />
          <span>
            <b>Mi propia IA</b>: las llamadas van directas a tu proveedor. Tu clave se guarda solo
            en este navegador, cifrada con una contraseña tuya.
          </span>
        </label>
        <label className="flex gap-2">
          <input
            type="radio"
            name="modoIa"
            checked={aj.modoIa === "demo"}
            onChange={() => cambia({ modoIa: "demo" })}
          />
          <span>
            <b>Demo</b>: respuestas de ejemplo, sin IA real ni red. Para ver cómo funciona la app.
          </span>
        </label>
      </fieldset>

      {aj.modoIa === "propia" && (
        <div className="space-y-3">
          <label className="block">
            Proveedor
            <select
              className="campo"
              value={aj.proveedorIa}
              onChange={(e) => eligeProveedor(e.target.value as ProveedorIaId)}
            >
              {ID_PRESETS.map((id) => (
                <option key={id} value={id}>
                  {PRESETS[id].nombre}
                </option>
              ))}
            </select>
          </label>
          {PRESETS[aj.proveedorIa].ayuda && (
            <p className="text-muted text-sm">{PRESETS[aj.proveedorIa].ayuda}</p>
          )}
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

          {clavePendiente && (
            <p role="status" className="bg-warn-soft text-warn rounded-lg p-3">
              Tu clave está guardada sin proteger de antes. Escribe una contraseña abajo y guarda
              para cifrarla.
            </p>
          )}
          {aj.claveCifrada && (
            <div className="space-y-2">
              <p role="status">
                {desbloqueada
                  ? "Clave desbloqueada en esta sesión."
                  : "Tu clave está cifrada y bloqueada: desbloquéala para usar la IA."}
              </p>
              {desbloqueada ? (
                <button className="boton-sec" onClick={olvida}>
                  Bloquear clave
                </button>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block grow">
                    Contraseña de tu clave
                    <input
                      className="campo"
                      type="password"
                      autoComplete="off"
                      value={passwordDesbloqueo}
                      onChange={(e) => setPasswordDesbloqueo(e.target.value)}
                    />
                  </label>
                  <button className="boton-sec" onClick={desbloquea}>
                    Desbloquear clave
                  </button>
                </div>
              )}
            </div>
          )}

          {(!sinClave || hayClave) && (
            <label className="block">
              {aj.claveCifrada ? "Clave nueva (opcional)" : "Clave de la API"}
              <input
                className="campo"
                type="password"
                autoComplete="off"
                value={claveNueva}
                onChange={(e) => {
                  setClaveNueva(e.target.value);
                  setGuardado(false);
                  setPrueba(null);
                }}
              />
            </label>
          )}
          {(claveNueva || clavePendiente) && (
            <label className="block">
              Contraseña para proteger la clave
              <input
                className="campo"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setGuardado(false);
                }}
              />
              <span className="text-muted text-sm">
                Mínimo {MIN_PASSWORD} caracteres. No se guarda: si la olvidas, tendrás que volver a
                escribir la clave.
              </span>
            </label>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button className="boton" onClick={guarda}>
          Guardar
        </button>
        <button className="boton-sec" disabled={probando} onClick={pruebaAhora}>
          {probando ? "Probando…" : "Probar conexión"}
        </button>
        <span role="status" className="text-ok">
          {guardado && "Guardado"}
        </span>
      </div>
      <div role="status">
        {error && <p className="bg-warn-soft text-warn rounded-lg p-3">{error}</p>}
        {prueba && (
          <p
            className={`rounded-lg p-3 ${prueba.ok ? "bg-accent-soft text-ok" : "bg-warn-soft text-warn"}`}
          >
            {prueba.mensaje}
          </p>
        )}
      </div>

      <MigrarAlmacen />
    </div>
  );
}
