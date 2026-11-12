import Dexie, { liveQuery, type EntityTable } from "dexie";
import { presetDe } from "../ia/presets.ts";
import type { Ajustes, Candidatura, Encaje, Oferta, Perfil, Preferencias } from "../tipos.ts";
import type { Almacenamiento, Datos, Lote } from "./tipos.ts";

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
    // v2: ajustes de almacenamiento y proveedor de IA, y asistente de primer uso. Quien ya usa la
    // app conserva su configuración: sus ajustes se completan y cuentan como ya configurados. Una
    // clave propia en claro se queda como estaba (cifrarla exige una contraseña que aquí no hay)
    // y Ajustes pide protegerla; en cuanto se protege, el campo en claro se borra.
    this.version(2)
      .stores({})
      .upgrade((tx) =>
        tx
          .table("ajustes")
          .toCollection()
          .modify((a: Ajustes) => {
            a.almacenamiento ??= "dexie";
            a.proveedorIa ??= presetDe(a.url);
            a.configurado ??= true;
          }),
      );
  }
}

/** Almacenamiento en IndexedDB (Dexie): lo que la app ha usado siempre. */
export class AlmacenDexie implements Almacenamiento {
  constructor(private readonly db: BaseDatos = new BaseDatos()) {}

  leerAjustes() {
    return this.db.ajustes.get("ajustes");
  }
  async guardarAjustes(ajustes: Ajustes) {
    await this.db.ajustes.put(ajustes);
  }

  leerPerfil() {
    return this.db.perfil.get("perfil");
  }
  async guardarPerfil(perfil: Perfil) {
    await this.db.perfil.put(perfil);
  }

  leerPreferencias() {
    return this.db.preferencias.get("preferencias");
  }
  async guardarPreferencias(preferencias: Preferencias) {
    await this.db.preferencias.put(preferencias);
  }

  listarOfertas() {
    return this.db.ofertas.toArray();
  }
  obtenerOfertas(ids: string[]) {
    return this.db.ofertas.bulkGet(ids);
  }
  async guardarOferta(oferta: Oferta) {
    await this.db.ofertas.put(oferta);
  }
  async guardarOfertas(ofertas: Oferta[]) {
    await this.db.ofertas.bulkPut(ofertas);
  }

  /** En una sola transacción. Las ofertas con candidatura se conservan. */
  async borrarOfertasNoGuardadas() {
    const { ofertas, encajes, candidaturas } = this.db;
    return this.db.transaction("rw", ofertas, encajes, candidaturas, async () => {
      const guardadas = new Set(await candidaturas.toCollection().primaryKeys());
      const ids = (await ofertas.toCollection().primaryKeys()).filter((id) => !guardadas.has(id));
      await ofertas.bulkDelete(ids);
      await encajes.bulkDelete(ids);
      return ids.length;
    });
  }

  listarEncajes() {
    return this.db.encajes.toArray();
  }
  obtenerEncajes(ofertaIds: string[]) {
    return this.db.encajes.bulkGet(ofertaIds);
  }
  async guardarEncaje(encaje: Encaje) {
    await this.db.encajes.put(encaje);
  }

  listarCandidaturas() {
    return this.db.candidaturas.toArray();
  }
  listarCandidaturasRecientes() {
    return this.db.candidaturas.orderBy("actualizada").reverse().toArray();
  }
  async idsCandidaturas() {
    return (await this.db.candidaturas.toCollection().primaryKeys()) as string[];
  }
  obtenerCandidatura(ofertaId: string) {
    return this.db.candidaturas.get(ofertaId);
  }
  async guardarCandidatura(candidatura: Candidatura) {
    await this.db.candidaturas.put(candidatura);
  }
  async actualizarCandidatura(ofertaId: string, cambios: Partial<Candidatura>) {
    await this.db.candidaturas.update(ofertaId, cambios);
  }
  async borrarCandidatura(ofertaId: string) {
    await this.db.candidaturas.delete(ofertaId);
  }

  async hayDatos() {
    return (await this.db.perfil.count()) + (await this.db.candidaturas.count()) > 0;
  }

  async leerDatos(): Promise<Datos> {
    return {
      perfil: await this.db.perfil.get("perfil"),
      preferencias: await this.db.preferencias.get("preferencias"),
      ofertas: await this.db.ofertas.toArray(),
      encajes: await this.db.encajes.toArray(),
      candidaturas: await this.db.candidaturas.toArray(),
    };
  }

  async escribirLote(lote: Lote) {
    const { ajustes, perfil, preferencias, ofertas, encajes, candidaturas } = this.db;
    await this.db.transaction(
      "rw",
      [ajustes, perfil, preferencias, ofertas, encajes, candidaturas],
      async () => {
        if (lote.ajustes) await ajustes.put(lote.ajustes);
        if (lote.perfil) await perfil.put(lote.perfil);
        if (lote.preferencias) await preferencias.put(lote.preferencias);
        if (lote.ofertas) await ofertas.bulkPut(lote.ofertas);
        if (lote.encajes) await encajes.bulkPut(lote.encajes);
        if (lote.candidaturas) await candidaturas.bulkPut(lote.candidaturas);
      },
    );
  }

  observar<T>(leer: () => Promise<T>, alCambiar: (valor: T) => void) {
    const suscripcion = liveQuery(leer).subscribe({ next: alCambiar, error: () => {} });
    return () => suscripcion.unsubscribe();
  }
}

/** El almacenamiento por defecto de la app. */
export const almacenDexie = new AlmacenDexie();
