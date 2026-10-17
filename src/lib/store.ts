import Dexie, { type EntityTable } from "dexie";
import type { Ajustes, Candidatura, Encaje, Oferta, Perfil, Preferencias } from "./tipos";

export class BaseDatos extends Dexie {
  ajustes!: EntityTable<Ajustes, "id">;
  perfil!: EntityTable<Perfil, "id">;
  preferencias!: EntityTable<Preferencias, "id">;
  ofertas!: EntityTable<Oferta, "id">;
  encajes!: EntityTable<Encaje, "ofertaId">;
  candidaturas!: EntityTable<Candidatura, "ofertaId">;

  constructor(nombre = "buscador-ofertas") {
    super(nombre);
    // Cada cambio de esquema es una versión nueva; nunca se edita una anterior.
    this.version(1).stores({
      ajustes: "id",
      perfil: "id",
      preferencias: "id",
      ofertas: "id, fuente",
      encajes: "ofertaId, nota",
      candidaturas: "ofertaId, estado, actualizada",
    });
  }
}

export const db = new BaseDatos();
