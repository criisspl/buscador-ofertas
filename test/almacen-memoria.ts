import type { Almacenamiento, Datos, Lote } from "../src/lib/almacen/tipos.ts";
import type {
  Ajustes,
  Candidatura,
  Encaje,
  Oferta,
  Perfil,
  Preferencias,
} from "../src/lib/tipos.ts";

/** Segundo adaptador, solo para tests: guarda todo en memoria y respeta el contrato. */
export class AlmacenMemoria implements Almacenamiento {
  ajustes?: Ajustes;
  perfil?: Perfil;
  preferencias?: Preferencias;
  ofertas = new Map<string, Oferta>();
  encajes = new Map<string, Encaje>();
  candidaturas = new Map<string, Candidatura>();
  /** Hace fallar la próxima escritura de lote (sin dejar nada escrito, como una transacción). */
  falloAlEscribir?: Error;
  escrituras = 0;

  async leerAjustes() {
    return this.ajustes;
  }
  async guardarAjustes(a: Ajustes) {
    this.ajustes = a;
  }
  async leerPerfil() {
    return this.perfil;
  }
  async guardarPerfil(p: Perfil) {
    this.perfil = p;
  }
  async leerPreferencias() {
    return this.preferencias;
  }
  async guardarPreferencias(p: Preferencias) {
    this.preferencias = p;
  }
  async listarOfertas() {
    return [...this.ofertas.values()];
  }
  async obtenerOfertas(ids: string[]) {
    return ids.map((id) => this.ofertas.get(id));
  }
  async guardarOferta(o: Oferta) {
    this.ofertas.set(o.id, o);
  }
  async guardarOfertas(os: Oferta[]) {
    for (const o of os) this.ofertas.set(o.id, o);
  }
  async borrarOfertasNoGuardadas() {
    const ids = [...this.ofertas.keys()].filter((id) => !this.candidaturas.has(id));
    for (const id of ids) {
      this.ofertas.delete(id);
      this.encajes.delete(id);
    }
    return ids.length;
  }
  async listarEncajes() {
    return [...this.encajes.values()];
  }
  async obtenerEncajes(ids: string[]) {
    return ids.map((id) => this.encajes.get(id));
  }
  async guardarEncaje(e: Encaje) {
    this.encajes.set(e.ofertaId, e);
  }
  async listarCandidaturas() {
    return [...this.candidaturas.values()];
  }
  async listarCandidaturasRecientes() {
    return [...this.candidaturas.values()].sort((a, b) => b.actualizada - a.actualizada);
  }
  async idsCandidaturas() {
    return [...this.candidaturas.keys()];
  }
  async obtenerCandidatura(id: string) {
    return this.candidaturas.get(id);
  }
  async guardarCandidatura(c: Candidatura) {
    this.candidaturas.set(c.ofertaId, c);
  }
  async actualizarCandidatura(id: string, cambios: Partial<Candidatura>) {
    const c = this.candidaturas.get(id);
    if (c) this.candidaturas.set(id, { ...c, ...cambios });
  }
  async borrarCandidatura(id: string) {
    this.candidaturas.delete(id);
  }
  async hayDatos() {
    return !!this.perfil || this.candidaturas.size > 0;
  }
  async leerDatos(): Promise<Datos> {
    return {
      perfil: this.perfil,
      preferencias: this.preferencias,
      ofertas: [...this.ofertas.values()],
      encajes: [...this.encajes.values()],
      candidaturas: [...this.candidaturas.values()],
    };
  }
  async escribirLote(l: Lote) {
    this.escrituras++;
    if (this.falloAlEscribir) throw this.falloAlEscribir;
    if (l.ajustes) this.ajustes = l.ajustes;
    if (l.perfil) this.perfil = l.perfil;
    if (l.preferencias) this.preferencias = l.preferencias;
    for (const o of l.ofertas ?? []) this.ofertas.set(o.id, o);
    for (const e of l.encajes ?? []) this.encajes.set(e.ofertaId, e);
    for (const c of l.candidaturas ?? []) this.candidaturas.set(c.ofertaId, c);
  }
  observar<T>(leer: () => Promise<T>, alCambiar: (valor: T) => void) {
    void leer().then(alCambiar, () => {});
    return () => {};
  }
}
