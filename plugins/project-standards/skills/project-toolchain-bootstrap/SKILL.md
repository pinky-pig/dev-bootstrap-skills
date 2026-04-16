---
name: project-toolchain-bootstrap
description: Bootstrap a pnpm JavaScript/TypeScript project with Arvinn's prettier/eslint/vscode conventions, including package.json scripts, lint-staged, simple-git-hooks, and an eslint.config.ts starter. Use when initializing a new project or aligning an existing project to this toolchain.
---

# JS Toolchain Bootstrap

Apply Arvinn's default frontend tooling to the current project.

## Workflow

1. Ensure the target project root has `package.json` and uses `pnpm`.
2. Run `node scripts/apply-project-toolchain-bootstrap.mjs` with the target project as working directory.
3. If `eslint.config.ts` exists but does not reference `@arvinn/eslint-config`, ask for confirmation before overwrite.
4. Let `npx arvinn-vscode-settings` complete (it may prompt before overwriting files in `.vscode`).

## What the script changes

- Installs dev dependencies:
  - `eslint`
  - `@arvinn/eslint-config`
  - `@arvinn/prettier-config`
  - `@arvinn/vscode-settings`
  - `lint-staged`
  - `simple-git-hooks`
- Merges `package.json` with:
  - `scripts.setup-arvin`
  - `scripts.prepare` including `simple-git-hooks`
  - `prettier: "@arvinn/prettier-config"`
  - `simple-git-hooks.pre-commit`
  - `lint-staged["*"]`
- Creates or updates `eslint.config.ts` based on the Arvinn template.
- Activates hooks with `pnpm exec simple-git-hooks`.
- Syncs VSCode settings via `npx arvinn-vscode-settings`.

## Notes

- This skill is intentionally `pnpm`-only.
- The script is idempotent for repeated runs.
- If overwrite is declined for `eslint.config.ts`, existing file is kept unchanged.
