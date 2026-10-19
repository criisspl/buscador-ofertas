import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  DIAS_POSPONER,
  DIAS_SIN_COPIA,
  marcarCopia,
  pedirPersistencia,
  posponer,
  tocaRecordar,
} from "../src/lib/recordatorio.ts";

const DIA = 24 * 60 * 60 * 1000;
const nuevo = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};
const AHORA = Date.UTC(2026, 9, 19);

describe("recordatorio de copia", () => {
  it("no recuerda si no hay datos", () => {
    assert.equal(tocaRecordar(nuevo(), false, AHORA), false);
  });

  it("recuerda si hay datos y nunca se hizo copia", () => {
    assert.equal(tocaRecordar(nuevo(), true, AHORA), true);
  });

  it("deja de recordar tras hacer copia y vuelve a los 14 días", () => {
    const a = nuevo();
    marcarCopia(a, AHORA);
    assert.equal(tocaRecordar(a, true, AHORA + (DIAS_SIN_COPIA - 1) * DIA), false);
    assert.equal(tocaRecordar(a, true, AHORA + DIAS_SIN_COPIA * DIA), true);
  });

  it("'Ahora no' silencia 7 días", () => {
    const a = nuevo();
    posponer(a, AHORA);
    assert.equal(tocaRecordar(a, true, AHORA + (DIAS_POSPONER - 1) * DIA), false);
    assert.equal(tocaRecordar(a, true, AHORA + DIAS_POSPONER * DIA), true);
  });

  it("no rompe si el almacenamiento falla o tiene basura", () => {
    const roto = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    marcarCopia(roto, AHORA);
    posponer(roto, AHORA);
    assert.equal(tocaRecordar(roto, true, AHORA), true);
    const basura = { getItem: () => "abc", setItem: () => undefined };
    assert.equal(tocaRecordar(basura, true, AHORA), true);
  });
});

describe("pedirPersistencia", () => {
  it("pide persistir solo si aún no lo está", async () => {
    let pedidas = 0;
    const ya = { persisted: async () => true, persist: async () => (pedidas++, true) };
    assert.equal(await pedirPersistencia(ya), true);
    assert.equal(pedidas, 0);
    const no = { persisted: async () => false, persist: async () => (pedidas++, true) };
    assert.equal(await pedirPersistencia(no), true);
    assert.equal(pedidas, 1);
  });

  it("devuelve false si no hay API o falla", async () => {
    assert.equal(await pedirPersistencia(undefined), false);
    const roto = {
      persisted: async () => {
        throw new Error("no");
      },
      persist: async () => true,
    };
    assert.equal(await pedirPersistencia(roto), false);
  });
});
