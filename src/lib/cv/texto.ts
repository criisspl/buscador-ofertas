// Lectura del CV en el navegador: el PDF no se sube a ningún servidor.

export const MAX_BYTES_CV = 5 * 1024 * 1024;
const MAX_PAGINAS = 10;
/** Mínimo de texto para considerar que el PDF tiene texto y no es un escaneo. */
const MIN_CARACTERES = 50;

type PdfJs = typeof import("pdfjs-dist");

export class ErrorCv extends Error {
  constructor(
    readonly codigo: "tipo" | "grande" | "paginas" | "sin-texto" | "ilegible",
    mensaje: string,
  ) {
    super(mensaje);
  }
}

async function cargarPdfjs(): Promise<PdfJs> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  return pdfjs;
}

/** Extrae el texto de un PDF. `pdfjs` se puede inyectar (los tests usan la versión de Node). */
export async function extraerTextoPdf(datos: ArrayBuffer, pdfjs?: PdfJs): Promise<string> {
  if (datos.byteLength > MAX_BYTES_CV)
    throw new ErrorCv("grande", "El CV pesa demasiado (máximo 5 MB).");
  const cabecera = new TextDecoder().decode(
    new Uint8Array(datos, 0, Math.min(5, datos.byteLength)),
  );
  if (cabecera !== "%PDF-") throw new ErrorCv("tipo", "El archivo no es un PDF.");

  const lib = pdfjs ?? (await cargarPdfjs());
  const tarea = lib.getDocument({ data: new Uint8Array(datos) });
  try {
    const pdf = await tarea.promise.catch(() => {
      throw new ErrorCv("ilegible", "No se ha podido leer el PDF. Prueba a exportarlo de nuevo.");
    });
    if (pdf.numPages > MAX_PAGINAS)
      throw new ErrorCv("paginas", `El CV tiene demasiadas páginas (máximo ${MAX_PAGINAS}).`);
    const paginas: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const contenido = await (await pdf.getPage(i)).getTextContent();
      paginas.push(
        contenido.items
          .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : ""))
          .join(""),
      );
    }
    const texto = paginas
      .join("\n\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (texto.length < MIN_CARACTERES)
      throw new ErrorCv(
        "sin-texto",
        "El PDF no tiene texto que se pueda leer (¿es un escaneo?). Prueba con un PDF exportado desde un editor.",
      );
    return texto;
  } finally {
    await tarea.destroy();
  }
}
