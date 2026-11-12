"use client";

import { createContext, use, type ReactNode } from "react";
import { almacenDexie } from "./dexie.ts";
import type { Almacenamiento } from "./tipos.ts";

const AlmacenContext = createContext<Almacenamiento | null>(null);

/** Da el almacenamiento a toda la app. Por defecto, IndexedDB; `almacen` permite cambiarlo. */
export function ProveedorAlmacen({
  almacen = almacenDexie,
  children,
}: {
  almacen?: Almacenamiento;
  children: ReactNode;
}) {
  return <AlmacenContext value={almacen}>{children}</AlmacenContext>;
}

/** El almacenamiento en uso. Solo funciona dentro de `ProveedorAlmacen`. */
export function useAlmacen(): Almacenamiento {
  const almacen = use(AlmacenContext);
  if (!almacen) throw new Error("useAlmacen necesita un ProveedorAlmacen.");
  return almacen;
}
