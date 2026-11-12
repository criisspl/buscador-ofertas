"use client";

import { useRef, useState } from "react";
import { useAlmacen } from "@/lib/almacen/contexto";
import { ErrorMigracion, migrar, type FaseMigracion } from "@/lib/almacen/migrar";
import { DESTINOS_MIGRACION, type DestinoMigracion } from "@/lib/almacen/opciones";
import { instantanea } from "@/lib/copia";

const TEXTO_FASE: Record<FaseMigracion, string> = {
  leyendo: "Leyendo tus datos…",
  validando: "Comprobando que son válidos…",
  "copia-previa": "Preparando la copia previa del destino…",
  escribiendo: "Escribiendo en el destino…",
  verificando: "Verificando lo copiado…",
};

function descarga(texto: string, nombre: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * «Cambiar de almacenamiento / copiar a otro». Copia los datos al destino elegido sin tocar el
 * origen. La clave de IA y los ajustes no viajan. `destinos` se puede cambiar para probarlo.
 */
export function MigrarAlmacen({
  destinos = DESTINOS_MIGRACION,
}: {
  destinos?: DestinoMigracion[];
}) {
  const almacen = useAlmacen();
  const [destinoId, setDestinoId] = useState(destinos[0]?.id ?? "");
  const [confirma, setConfirma] = useState(false);
  const [pideConfirmar, setPideConfirmar] = useState(false);
  const [fase, setFase] = useState<FaseMigracion | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [esError, setEsError] = useState(false);
  const [copiaPrevia, setCopiaPrevia] = useState<string>();
  const control = useRef<AbortController | null>(null);
  const trabajando = fase !== null;

  const copia = async () => {
    const destino = destinos.find((d) => d.id === destinoId);
    if (!destino) return;
    const abort = new AbortController();
    control.current = abort;
    setMensaje("");
    setEsError(false);
    setCopiaPrevia(undefined);
    try {
      const r = await migrar(almacen, destino.crear(), {
        sobrescribir: confirma,
        senal: abort.signal,
        alProgreso: (f) => setFase(f),
      });
      setCopiaPrevia(r.copiaPrevia);
      setPideConfirmar(false);
      setConfirma(false);
      setMensaje(
        `Copiado a «${destino.nombre}»: ${r.ofertas} ofertas, ${r.encajes} encajes y ${r.candidaturas} candidaturas${r.perfil ? " y tu perfil" : ""}. Tus datos de origen siguen donde estaban.`,
      );
    } catch (e) {
      setEsError(true);
      if (e instanceof ErrorMigracion) {
        setPideConfirmar(e.codigo === "destino-no-vacio");
        setCopiaPrevia(e.copiaPrevia);
        setMensaje(e.message);
      } else setMensaje("No se ha podido copiar. Tus datos de origen siguen intactos.");
    } finally {
      setFase(null);
      control.current = null;
    }
  };

  return (
    <section className="space-y-3 border-t border-gray-200 pt-4">
      <h2 className="text-xl font-semibold">Cambiar de almacenamiento / copiar a otro</h2>
      <p className="text-muted">
        Copia tus datos (perfil, ofertas, encajes y candidaturas) a otro almacenamiento sin perder
        nada. Tu clave de IA y estos ajustes no se copian, y los datos de aquí no se borran.
      </p>

      {destinos.length === 0 ? (
        <p className="text-muted">
          Hoy solo hay un almacenamiento (este navegador), así que no hay a dónde copiar. Mientras
          tanto, puedes guardar una copia en un archivo.
        </p>
      ) : (
        <div className="space-y-3">
          <label className="block">
            Copiar a
            <select
              className="campo"
              value={destinoId}
              disabled={trabajando}
              onChange={(e) => {
                setDestinoId(e.target.value as typeof destinoId);
                setPideConfirmar(false);
                setConfirma(false);
              }}
            >
              {destinos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </label>
          {pideConfirmar && (
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={confirma}
                onChange={(e) => setConfirma(e.target.checked)}
              />
              <span>
                El destino ya tiene datos. Entiendo que lo que coincida se sobrescribirá; se me dará
                una copia previa del destino para descargarla.
              </span>
            </label>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              className="boton"
              disabled={trabajando || (pideConfirmar && !confirma)}
              onClick={copia}
            >
              Copiar
            </button>
            {trabajando && (
              <button className="boton-sec" onClick={() => control.current?.abort()}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      <div role="status">
        {fase && <p>{TEXTO_FASE[fase]}</p>}
        {mensaje && (
          <p
            className={`rounded-lg p-3 ${esError ? "bg-warn-soft text-warn" : "bg-accent-soft text-ok"}`}
          >
            {mensaje}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          className="boton-sec"
          disabled={trabajando}
          onClick={async () => descarga(await instantanea(almacen), "buscador-ofertas-copia.json")}
        >
          Descargar copia (JSON)
        </button>
        {copiaPrevia && (
          <button
            className="boton-sec"
            onClick={() => descarga(copiaPrevia, "buscador-ofertas-destino-previo.json")}
          >
            Descargar copia previa del destino
          </button>
        )}
      </div>
    </section>
  );
}
