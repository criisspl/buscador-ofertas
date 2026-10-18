import type { BaseDatos } from "./store.ts";
import type { Oferta } from "./tipos.ts";

// Datos inventados para enseñar la app sin CV ni claves. Nada de esto es real.
const oferta = (
  n: number,
  titulo: string,
  empresa: string,
  ubicacion: string,
  descripcion: string,
) =>
  ({
    id: `demo:${n}`,
    fuente: "demo",
    idExterno: String(n),
    titulo,
    empresa,
    ubicacion,
    url: `https://example.com/demo/${n}`,
    descripcion,
  }) satisfies Oferta;

export const OFERTAS_DEMO: Oferta[] = [
  oferta(
    1,
    "Desarrollador/a frontend React",
    "Acme Digital",
    "Madrid",
    "Equipo de producto. React, TypeScript y testing. Cuidamos la accesibilidad.",
  ),
  oferta(
    2,
    "Frontend con Angular",
    "Nube Norte",
    "Remoto",
    "Aplicación interna en Angular y TypeScript. Git y CSS.",
  ),
  oferta(
    3,
    "Full stack Node.js",
    "Taller de Datos",
    "Barcelona",
    "API en Node.js y TypeScript, front en React. Testing y Git.",
  ),
  oferta(
    4,
    "Ingeniero/a backend Java",
    "Banco Ejemplo",
    "Madrid",
    "Servicios en Java y AWS. Experiencia en sistemas distribuidos.",
  ),
  oferta(
    5,
    "Desarrollador/a web junior",
    "Estudio Pixel",
    "Valencia",
    "Maquetación con CSS y algo de JavaScript. Ganas de aprender.",
  ),
  oferta(
    6,
    "Frontend senior TypeScript",
    "Plataforma Sur",
    "Remoto",
    "Arquitectura de interfaces con React y TypeScript. Testing, Git y Node.js.",
  ),
];

export async function hayDatos(db: BaseDatos) {
  return (await db.perfil.count()) + (await db.candidaturas.count()) > 0;
}

/** Carga el perfil, las preferencias y unas ofertas de ejemplo, y pone la IA en modo demo. */
export async function cargarDemo(db: BaseDatos) {
  await db.transaction("rw", [db.ajustes, db.perfil, db.preferencias, db.ofertas], async () => {
    await db.ajustes.put({ id: "ajustes", modoIa: "demo" });
    await db.perfil.put({
      id: "perfil",
      skills: ["React", "TypeScript", "Node.js", "CSS", "Testing", "Git"],
      experiencia: [
        {
          puesto: "Desarrolladora frontend",
          empresa: "Estudio Ejemplo",
          desde: "2022",
          hasta: "2025",
        },
      ],
      idiomas: ["Español nativo", "Inglés B2"],
      textoCv: "CV de ejemplo (modo demo).",
    });
    await db.preferencias.put({
      id: "preferencias",
      puestos: ["Frontend", "React"],
      ubicacion: "Madrid",
      remoto: true,
      sectoresEvitar: [],
    });
    await db.ofertas.bulkPut(OFERTAS_DEMO);
  });
}
