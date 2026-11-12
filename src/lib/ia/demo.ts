import type { Pregunta } from "./tipos.ts";

// Modo demo: respuestas de ejemplo, sin red ni IA. Sirve para enseñar la app sin claves.

const SKILLS_DEMO = ["React", "TypeScript", "Node.js", "CSS", "Testing", "Git"];

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Texto de la oferta dentro del mensaje de encaje (tras la línea OFERTA:). */
const ofertaDe = (texto: string) => texto.split("OFERTA:")[1] ?? texto;

function encaje(texto: string) {
  const oferta = norm(ofertaDe(texto));
  const cumple = SKILLS_DEMO.filter((s) => oferta.includes(norm(s)));
  const falta = ["Angular", "Java", "Python", "Go", "AWS"].filter((s) => oferta.includes(norm(s)));
  const nota = Math.max(15, Math.min(95, 30 + cumple.length * 13 - falta.length * 12));
  return {
    nota,
    cumple: cumple.map((s) => `Dominas ${s}`),
    falta: falta.map((s) => `Piden ${s}`),
  };
}

export function respuestaDemo(p: Pregunta): string {
  switch (p.tarea) {
    case "perfil":
      return JSON.stringify({
        skills: SKILLS_DEMO,
        experiencia: [
          {
            puesto: "Desarrolladora frontend",
            empresa: "Estudio Ejemplo",
            desde: "2022",
            hasta: "2025",
          },
        ],
        idiomas: ["Español nativo", "Inglés B2"],
      });
    case "encaje":
      return JSON.stringify(encaje(p.texto));
    default:
      return "Hola, equipo:\n\nMe ha gustado mucho esta oferta. Llevo tres años construyendo interfaces con React y TypeScript, cuidando las pruebas y la accesibilidad, y me gustaría aportar eso a vuestro proyecto.\n\nEste texto es de ejemplo (modo demo): con una IA real la carta se adapta a tu perfil y a la oferta.\n\nUn saludo.";
  }
}
