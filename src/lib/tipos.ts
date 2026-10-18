// Tipos del dominio. Todo lo personal vive solo en el navegador (IndexedDB).

export type EstadoCandidatura = "guardada" | "enviada" | "entrevista" | "oferta" | "descartada";

export interface Ajustes {
  id: "ajustes";
  /** "app" usa la IA de la app; "propia" usa la clave del usuario; "demo" responde con textos de ejemplo, sin red. */
  modoIa: "app" | "propia" | "demo";
  url?: string;
  modelo?: string;
  clave?: string;
}

export interface Perfil {
  id: "perfil";
  skills: string[];
  experiencia: { puesto: string; empresa: string; desde?: string; hasta?: string }[];
  idiomas: string[];
  textoCv: string;
}

export interface Preferencias {
  id: "preferencias";
  puestos: string[];
  ubicacion: string;
  remoto: boolean;
  salarioMinimo?: number;
  jornada?: "completa" | "parcial" | "cualquiera";
  sectoresEvitar: string[];
}

export interface Oferta {
  /** `${fuente}:${idExterno}`, para deduplicar entre portales. */
  id: string;
  fuente: string;
  idExterno: string;
  titulo: string;
  empresa: string;
  ubicacion: string;
  salario?: string;
  url: string;
  descripcion: string;
}

export interface Encaje {
  ofertaId: string;
  nota: number;
  cumple: string[];
  falta: string[];
  proveedor: string;
}

export interface Candidatura {
  ofertaId: string;
  estado: EstadoCandidatura;
  carta: string;
  notas: string;
  creada: number;
  actualizada: number;
}
