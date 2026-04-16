---
name: express-modular-bootstrap
description: Bootstrap an Express + TypeScript backend with modules-first architecture (controller/service/model/routes) inspired by oopus-flow server structure. Use for new server initialization or when refactoring a flat server into src/modules style.
---

# Express Modular Bootstrap

Apply a modules-first Express server structure.

## Workflow

1. Run `node scripts/apply-express-modular-bootstrap.mjs` in the server project root.
2. Script ensures dependencies, scripts, tsconfig, and `src` architecture.
3. Optionally scaffold module files in one command:
   - `node scripts/apply-express-modular-bootstrap.mjs --module user`

## Generated architecture

- `src/app.ts`, `src/index.ts`
- `src/common/{errors,handler,middleware,utils}`
- `src/config`, `src/docs`
- `src/infrastructure/{db,queue}`
- `src/modules/*` (controller/service/model/routes per module)
- `src/tests/{unit,integration,manual}`

## Notes

- This skill is intentionally `pnpm`-only.
- Re-running is idempotent: existing files are kept unless missing.
- New modules follow `<name>.controller.ts / <name>.service.ts / <name>.model.ts / <name>.routes.ts`.
