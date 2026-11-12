import { useState, useSyncExternalStore } from "react";
import { useAlmacen } from "./almacen/contexto.tsx";
import type { Almacenamiento } from "./almacen/tipos.ts";

export type Consulta<T> = {
  subscribe: (avisar: () => void) => () => void;
  getSnapshot: () => T | undefined;
};

/**
 * Envuelve una consulta al almacenamiento como fuente externa para `useSyncExternalStore`.
 * El valor se guarda en una variable y solo cambia cuando el almacenamiento avisa, así el
 * snapshot es estable entre renders. Vale `undefined` mientras carga la primera vez.
 */
export function crearConsulta<T>(
  almacen: Almacenamiento,
  consulta: (almacen: Almacenamiento) => T | Promise<T>,
): Consulta<T> {
  let valor: T | undefined;
  const oyentes = new Set<() => void>();
  let cancelar: (() => void) | null = null;

  const arranca = () => {
    // Un fallo de lectura no debe tumbar la página: se queda el último valor.
    cancelar = almacen.observar(
      async () => consulta(almacen),
      (nuevo) => {
        valor = nuevo;
        oyentes.forEach((avisar) => avisar());
      },
    );
  };

  return {
    subscribe: (avisar) => {
      oyentes.add(avisar);
      if (oyentes.size === 1) arranca();
      return () => {
        oyentes.delete(avisar);
        if (oyentes.size === 0) {
          cancelar?.();
          cancelar = null;
        }
      };
    },
    getSnapshot: () => valor,
  };
}

const sinDatos = () => undefined;

/**
 * Resultado de una consulta al almacenamiento que se actualiza sola cuando cambian los datos
 * (también desde otra pestaña). `undefined` mientras carga.
 * `consulta` se lee solo en el primer render: no puede depender de props ni de estado.
 */
export function useConsulta<T>(
  consulta: (almacen: Almacenamiento) => T | Promise<T>,
): T | undefined {
  const almacen = useAlmacen();
  const [fuente] = useState(() => crearConsulta(almacen, consulta));
  return useSyncExternalStore(fuente.subscribe, fuente.getSnapshot, sinDatos);
}
