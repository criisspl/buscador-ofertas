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
