import type { ProveedorIaId } from "../tipos.ts";

export interface Preset {
  nombre: string;
  url: string;
  modelo: string;
  /** Se ejecuta en tu equipo y no pide clave. */
  sinClave?: boolean;
  ayuda?: string;
}

/** Valores sugeridos: la persona puede editar la dirección y el modelo. */
export const PRESETS: Record<ProveedorIaId, Preset> = {
  groq: {
    nombre: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    modelo: "llama-3.3-70b-versatile",
  },
  mistral: {
    nombre: "Mistral",
    url: "https://api.mistral.ai/v1/chat/completions",
    modelo: "mistral-small-latest",
  },
  openai: {
    nombre: "OpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    modelo: "gpt-4o-mini",
  },
  ollama: {
    nombre: "Ollama (en tu equipo)",
    url: "http://localhost:11434/v1/chat/completions",
    modelo: "llama3.2",
    sinClave: true,
    ayuda:
      "Ollama tiene que estar en marcha y permitir este sitio: arráncalo con OLLAMA_ORIGINS=<dirección de esta web>.",
  },
  otro: { nombre: "Otro (compatible con OpenAI)", url: "", modelo: "" },
};

export const ID_PRESETS = Object.keys(PRESETS) as ProveedorIaId[];

/** Qué proveedor predefinido corresponde a una dirección ya guardada. */
export function presetDe(url: string | undefined): ProveedorIaId {
  if (!url) return "otro";
  return ID_PRESETS.find((id) => PRESETS[id].url && PRESETS[id].url === url) ?? "otro";
}
