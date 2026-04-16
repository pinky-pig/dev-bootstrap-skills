# Dev Bootstrap Skills

一个用于沉淀和分发开发规范 Skill 的集合仓库（多插件、多 skill）。

## 安装

安装整个 skills 集合（skills CLI）：

```bash
npx skills add pinky-pig/dev-bootstrap-skills
```

安装整个插件集合（plugins CLI）：

```bash
npx plugins add pinky-pig/dev-bootstrap-skills
```

只安装单个插件（通过插件目录路径）：

```bash
npx plugins add /Users/wangwenbo/Documents/wangwenbo/Mine/dev-bootstrap-skills/plugins/project-standards
```

安装本地路径（单个 skill）：

```bash
npx skills add /Users/wangwenbo/Documents/wangwenbo/Mine/dev-bootstrap-skills/plugins/project-standards/skills/project-toolchain-bootstrap
```

## 当前插件与技能

### `project-standards`

- `project-toolchain-bootstrap`
  - 为 `pnpm` 项目接入：
    - `@arvinn/eslint-config`
    - `@arvinn/prettier-config`
    - `@arvinn/vscode-settings`
    - `lint-staged` + `simple-git-hooks`
- `tailwind-iconify-bootstrap`
  - 为 Tailwind CSS v4+ 项目接入：
    - `@egoist/tailwindcss-icons`
    - `@iconify-json/carbon`
    - `@iconify-json/solar`
  - 自动更新 `tailwind.config.*` 与全局 CSS 指令（`@config/@import/@plugin`）
- `pnpm-monorepo-bootstrap`
  - 参考 postly 风格初始化/改造 monorepo：
    - `pnpm-workspace.yaml`（`apps/*` + `packages/*`）
    - `apps/web` 默认应用目录
    - 支持将单前端项目迁移到 `apps/web`

### `backend-templates`

- `express-modular-bootstrap`
  - 参考 `oopus-flow/apps/server/src` 的 TypeScript 模块化服务端结构：
    - `src/modules/<name>/<name>.controller.ts`
    - `src/modules/<name>/<name>.service.ts`
    - `src/modules/<name>/<name>.model.ts`
    - `src/modules/<name>/<name>.routes.ts`
  - 自动补齐 `common/config/docs/infrastructure/tests` 目录骨架
  - 支持 `--module <name>` 一键生成模块文件

## 扩展方式（新增插件）

后续如果有新的能力域（例如 `vue` 管理后台模板、`nextjs` 前端模板），直接在 `plugins/` 下新增目录，再在该插件里放多个 skill：

```text
plugins/
  project-standards/
    plugin.json
    skills/
      project-toolchain-bootstrap/
      tailwind-iconify-bootstrap/
      pnpm-monorepo-bootstrap/

  backend-templates/
    plugin.json
    skills/
      express-modular-bootstrap/

  vue-admin-templates/
    plugin.json
    skills/
      vue-admin-starter/
      vue-admin-dashboard-layout/

  nextjs-frontend-templates/
    plugin.json
    skills/
      nextjs-landing-starter/
      nextjs-app-shell/
```

每个 skill 最小结构：

```text
skills/<skill-name>/
  SKILL.md
  scripts/        # 可选
  references/     # 可选
  assets/         # 可选
```

## 仓库结构

```text
dev-bootstrap-skills/
  apps/web/                 # skills web 页面（占位）
  .github/workflows/        # CI/发包工作流（占位）
  plugins/
    ...
```
