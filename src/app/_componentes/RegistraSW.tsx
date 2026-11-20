"use client";

import { useEffect } from "react";

// Registra el service worker (solo en producción) y pide almacenamiento persistente:
// los datos viven en IndexedDB y iOS los borra a los 7 días sin uso.
export function RegistraSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    void navigator.storage?.persist?.();
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
  }, []);
  return null;
}
