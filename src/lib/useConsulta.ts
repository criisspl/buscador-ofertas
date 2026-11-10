import { liveQuery } from "dexie";
import { useState, useSyncExternalStore } from "react";

export type Consulta<T> = {
  subscribe: (avisar: () => void) => () => void;
  getSnapshot: () => T | undefined;
};

/**
 * Envuelve una consulta de Dexie como fuente externa para `useSyncExternalStore`.
 * El valor se guarda en una variable y solo cambia cuando `liveQuery` emite, así el
 * snapshot es estable entre renders. Vale `undefined` mientras carga la primera vez.
 */
export function crearConsulta<T>(consulta: () => T | Promise<T>): Consulta<T> {
  let valor: T | undefined;
  const oyentes = new Set<() => void>();
  let suscripcion: { unsubscribe: () => void } | null = null;

  const arranca = () => {
    suscripcion = liveQuery(consulta).subscribe({
      next: (nuevo) => {
        valor = nuevo;
        oyentes.forEach((avisar) => avisar());
      },
      // Un fallo de IndexedDB no debe tumbar la página: se queda el último valor.
      error: () => {},
    });
  };

  return {
    subscribe: (avisar) => {
      oyentes.add(avisar);
      if (oyentes.size === 1) arranca();
      return () => {
        oyentes.delete(avisar);
        if (oyentes.size === 0) {
          suscripcion?.unsubscribe();
          suscripcion = null;
        }
      };
    },
    getSnapshot: () => valor,
  };
}

const sinDatos = () => undefined;

/**
 * Resultado de una consulta de Dexie que se actualiza sola cuando cambian los datos
 * (también desde otra pestaña). `undefined` mientras carga.
 * `consulta` se lee solo en el primer render: no puede depender de props ni de estado.
 */
export function useConsulta<T>(consulta: () => T | Promise<T>): T | undefined {
  const [fuente] = useState(() => crearConsulta(consulta));
  return useSyncExternalStore(fuente.subscribe, fuente.getSnapshot, sinDatos);
}
