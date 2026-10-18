# CLAUDE.md

Solo lo propio de este repo; las reglas generales y las skills vienen de [claude-config](https://github.com/criisspl/claude-config). Cada línea está aquí porque sin ella Claude se equivocaría; si una deja de hacer falta, bórrala.

@AGENTS.md

## Stack y comandos

- Next.js 16 (App Router en `src/app/`), React 19, TypeScript, Tailwind 4. Node 22.
- Datos de la persona (perfil, CV, ofertas, encajes, candidaturas) en IndexedDB con Dexie (`src/lib/store.ts`).
- Rutas de servidor: `/api/ia` (intermediario con la IA: Groq y, de reserva, Mistral) y `/api/ofertas` (Adzuna, Jooble y Remotive). Límite por persona con Upstash.
- Validación con zod; CV en PDF leído con `pdfjs-dist`.
- Tests: Vitest en `test/`, con `fake-indexeddb` para el store.
- Alias `@/` → `src/`.

| Qué            | Comando                                      |
| -------------- | -------------------------------------------- |
| Instalar       | `npm ci`                                     |
| Dev            | `npm run dev`                                |
| Tests          | `npm test`                                   |
| Tipos          | `npm run typecheck` (`next typegen` + `tsc`) |
| Lint y formato | `npm run lint` · `npm run format`            |
| Build          | `npm run build`                              |

CI ejecuta lint, `format:check`, tipos, tests y build: todo tiene que pasar antes de dar algo por hecho. El pre-commit (husky) pasa lint, formato, tipos y tests. Los commits siguen Conventional Commits (commitlint).

## Estructura

- `src/app/`: páginas (`perfil`, `ofertas`, `ajustes`) y rutas `api/`.
- `src/lib/`: lógica testeable. `ia/` (cliente, servidor, validación), `ofertas/fuentes.ts`, `cv/`, `encaje.ts`, `limite.ts`, `tipos.ts`.
- `test/`: un `*.test.ts` por módulo.

## Reglas del proyecto

- Las claves (`GROQ_API_KEY`, `MISTRAL_API_KEY`, Upstash, Adzuna, Jooble) van solo en `.env.local` y en el servidor; nunca en código de cliente ni en el repo. Ver `.env.example`.
- En `/api/ia` el modelo y los límites los decide el servidor, no el cliente; toda entrada pasa por `ia/valida.ts`.
- Upstash es obligatorio en producción: sin él no hay límite por persona.
- Dexie: cada cambio de esquema es una `version()` nueva; nunca se edita una anterior.
- Los datos de la persona no se guardan en el servidor: solo pasan por él para llamar a la IA.
- Textos de la interfaz y comentarios en español.
- No añadas dependencias sin preguntar.

<!-- claude-config:inicio · no edites este bloque: lo gestiona claude-config -->

## Reglas de los paquetes (claude-config v1.0.1)

### indexeddb

- Cada cambio de esquema es una versión nueva (`db.version(n+1).stores(...)`), con `.upgrade()` si hay que migrar datos. Una versión con `upgrade` ya publicada no se edita nunca.
- Dentro de una transacción no hagas `await` de nada ajeno a IndexedDB (`fetch`, `setTimeout`, crypto...): se auto-confirma. Haz primero lo asíncrono y abre la transacción después.
- Safari borra el almacenamiento tras 7 días de uso sin interacción con el sitio (salvo apps instaladas en pantalla de inicio): pide `navigator.storage.persist()` y ofrece copia de seguridad exportable.
- Tests con `fake-indexeddb` (importando `fake-indexeddb/auto`), con una base nueva por test.
- UI reactiva con Dexie: `liveQuery()`, no recargas a mano.

### nextjs

- Antes de escribir código de Next.js, lee la guía de `node_modules/next/dist/docs/` (lo pide el `AGENTS.md` que genera Next): esta versión rompe cosas respecto a tu memoria. Haz caso a los avisos de deprecación.
- App Router y Server Components por defecto; `"use client"` solo en el componente hoja que necesita estado, efectos o APIs del navegador, nunca en páginas o layouts enteros.
- En la 16 `params`, `searchParams`, `cookies()`, `headers()` y `draftMode()` son asíncronos: siempre `await`. Para tiparlos usa `PageProps<'/ruta'>`, `LayoutProps` y `RouteContext` (se generan con `next typegen`).
- Server Actions y Route Handlers son endpoints públicos: valida la entrada en el servidor y comprueba autenticación y autorización dentro de cada uno (el chequeo de la página no vale).
- Solo `NEXT_PUBLIC_*` llega al navegador y se inlinea en el build: nunca secretos ahí. Código solo de servidor, con `import 'server-only'`.
- `middleware.ts` ya no existe: es `proxy.ts` con `export function proxy`. `revalidateTag` exige un segundo argumento (`revalidateTag('x', 'max')`); `updateTag` solo en Server Actions. No uses `next lint`.

### react

- React 19: `ref` es una prop normal en componentes de función; no uses `forwardRef` en código nuevo. Usa `<Context value={...}>` en vez de `<Context.Provider>`.
- Formularios: `<form action={fn}>` con `useActionState` (`[state, formAction, isPending]`; la acción recibe `(prevState, formData)`). Errores esperados se devuelven como estado, no se lanzan. `useFormStatus` se importa de `react-dom`.
- No uses `useEffect` para derivar estado ni para reaccionar a clics: calcula en el render o usa el event handler. Effects solo para sincronizar con sistemas externos (red, DOM no-React, suscripciones), siempre con cleanup.
- No añadas `useMemo`/`useCallback`/`React.memo` por defecto; solo si el proyecto no usa React Compiler y hay un problema de rendimiento medido, o necesitas una referencia estable concreta.
- `key` estable y única por dato (id); nunca el índice en listas que se reordenan o editan. Para resetear el estado de un subárbol, cambia su `key`.

### tailwind

- Tailwind 4 es CSS-first: el CSS empieza con `@import "tailwindcss";` (no `@tailwind base/components/utilities`) y el tema se define con `@theme { --color-brand: ...; }`. No crees `tailwind.config.js`; si existe, se carga con `@config`.
- Con Vite usa `@tailwindcss/vite` en `plugins`; con PostCSS, `@tailwindcss/postcss` (sin `postcss-import` ni `autoprefixer`).
- Clases renombradas: `shadow-sm`→`shadow-xs`, `shadow`→`shadow-sm`, igual con `blur`, `rounded` y `drop-shadow`; `outline-none`→`outline-hidden`; `ring`→`ring-3`; `flex-shrink-*`/`flex-grow-*`→`shrink-*`/`grow-*`.
- Opacidad con modificador (`bg-black/50`), no `bg-opacity-*`. Variables CSS en valores arbitrarios con paréntesis: `bg-(--brand)`. El `!` de important va al final: `flex!`.
- El borde por defecto ahora es `currentColor`: pon siempre color explícito (`border-gray-200`). Utilidades propias con `@utility`, no con `@layer utilities`.

### typescript

- Prohibido `any` (y `as any`, `@ts-ignore`): usa `unknown` y acota con comprobaciones, o un tipo del dominio. Si de verdad hace falta suprimir, `@ts-expect-error` con motivo.
- Con `verbatimModuleSyntax`, lo que solo es tipo se importa con `import type { X }` o `import { type X }`; si no, el typecheck falla.
- Con `allowImportingTsExtensions`, los imports relativos llevan la extensión `.ts` explícita (`./foo.ts`, no `./foo`).
- Para objetos de configuración o tablas usa `satisfies Tipo` en vez de anotar, para no perder los literales. Evita `as` para "arreglar" errores de tipos.
- No des un cambio por bueno sin pasar el typecheck del repo (`tsc --noEmit` o su script).

### vitest

- Es Vitest, no Jest: `vi.fn`, `vi.spyOn`, `vi.mock`, nunca `jest.*`. Importa `describe/it/expect/vi` de `vitest` salvo que `globals` esté activo.
- `vi.mock` se hoistea encima de los imports: si la factory necesita variables externas, créalas con `vi.hoisted`.
- Restaura lo que toques: `vi.useRealTimers()` tras `vi.useFakeTimers()`, `vi.unstubAllGlobals()`/`vi.unstubAllEnvs()` tras stubs, y `vi.restoreAllMocks()` de los spies.
- Prefiere aserciones precisas (`toEqual`, `toMatchObject`, `toThrow(...)`) a `toBeTruthy`; si el repo usa `node:assert/strict`, sigue ese estilo.

### zod

- Zod 4: formatos como funciones top-level (`z.email()`, `z.url()`, `z.uuid()`, `z.iso.datetime()`), no `z.string().email()` (deprecado).
- Mensajes personalizados con `{ error: "..." }`, no `message`; `invalid_type_error` y `required_error` ya no existen.
- Todo dato externo (body, query, JSON del disco, respuesta de API) se valida con `safeParse` y se gestiona `success: false`; no uses `parse` salvo que quieras que reviente.
- El tipo se deriva del schema (`type X = z.infer<typeof X>`); no lo escribas a mano aparte.
- `z.record` lleva siempre clave y valor; `z.strictObject`/`z.looseObject` en vez de `.strict()`/`.passthrough()`; `z.enum(...)` en vez de `z.nativeEnum`.

<!-- claude-config:fin -->
