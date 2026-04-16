---
name: tailwind-iconify-bootstrap
description: Bootstrap Tailwind CSS v4 icon workflow using @egoist/tailwindcss-icons with Iconify JSON collections (carbon and solar). Use when setting up React/Vue projects that should use class-based icons like i-solar-*.
---

# Tailwind Iconify Bootstrap

Standardize Tailwind v4 + Iconify setup for Arvinn projects.

## Workflow

1. Ensure the target project root has `package.json` and uses `pnpm`.
2. Ensure the project already uses Tailwind CSS v4+.
3. Run `node scripts/apply-tailwind-iconify-bootstrap.mjs` from the target project root.
4. Verify icon class usage, for example: `<div class="i-solar-gallery-add-outline w-6 h-6"></div>`.

## What the script changes

- Installs dependencies:
  - `@egoist/tailwindcss-icons`
  - `@iconify-json/carbon`
  - `@iconify-json/solar`
- Updates `tailwind.config.*`:
  - adds import from `@egoist/tailwindcss-icons`
  - ensures plugin registration with `getIconCollections(['carbon', 'solar'])`
- Updates global css entry (auto-detected):
  - ensures `@import 'tailwindcss';`
  - ensures `@plugin '@egoist/tailwindcss-icons';`
  - ensures `@config '<relative-tailwind-config-path>';`

## Notes

- This skill is intentionally `pnpm`-only.
- Tailwind CSS major version must be 4 or above.
- The script is idempotent for repeated runs.
- Supported tailwind config format is ESM object export (`export default { ... }`).
