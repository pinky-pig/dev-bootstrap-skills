#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { constants } from 'node:fs'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'

const BASE_DIRS = [
  'src/common/errors',
  'src/common/handler',
  'src/common/middleware',
  'src/common/utils',
  'src/config',
  'src/docs',
  'src/infrastructure/db',
  'src/infrastructure/queue',
  'src/modules',
  'src/tests/unit',
  'src/tests/integration',
  'src/tests/manual',
]

const RUNTIME_DEPS = ['express', 'cors', 'zod']
const DEV_DEPS = ['typescript', 'tsx', '@types/node', '@types/express', '@types/cors']

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  })

  if (result.error)
    throw result.error

  if (result.status !== 0)
    throw new Error(`Command failed: ${command} ${args.join(' ')}`)
}

function hasPnpm() {
  const result = spawnSync('pnpm', ['--version'], { stdio: 'ignore' })
  return result.status === 0
}

function getArgValue(key) {
  const args = process.argv.slice(2)

  const exact = args.find(arg => arg.startsWith(`${key}=`))
  if (exact)
    return exact.slice(key.length + 1)

  const index = args.indexOf(key)
  if (index >= 0)
    return args[index + 1]

  return null
}

async function exists(file) {
  try {
    await access(file, constants.F_OK)
    return true
  }
  catch {
    return false
  }
}

async function ensureFile(path, content) {
  if (!await exists(path))
    await writeFile(path, `${content.trimEnd()}\n`, 'utf8')
}

async function readJson(path) {
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw)
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function ensureScripts(pkg) {
  pkg.scripts = pkg.scripts && typeof pkg.scripts === 'object' && !Array.isArray(pkg.scripts)
    ? pkg.scripts
    : {}

  const defaults = {
    dev: 'tsx watch src/index.ts',
    build: 'tsc -p tsconfig.json',
    start: 'node dist/index.js',
    typecheck: 'tsc --noEmit',
  }

  for (const [key, value] of Object.entries(defaults)) {
    if (!pkg.scripts[key])
      pkg.scripts[key] = value
  }
}

async function ensurePackageJson() {
  const pkg = await readJson('package.json')

  if (!pkg.type)
    pkg.type = 'module'
  if (!pkg.private)
    pkg.private = true

  ensureScripts(pkg)

  await writeJson('package.json', pkg)
}

async function ensureTsconfig() {
  const content = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
`

  await ensureFile('tsconfig.json', content)
}

async function ensureBaseFiles() {
  const files = {
    'src/app.ts': `import express, { type Express } from 'express'
import cors from 'cors'
import { errorHandler, notFoundHandler } from './common/middleware/index.js'

const app: Express = express()

app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '2mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

// module routes example:
// import userRouter from './modules/user/user.routes.js'
// app.use('/api/users', userRouter)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
`,
    'src/index.ts': `import app from './app.js'

const PORT = Number(process.env.PORT || 3000)

app.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`)
})
`,
    'src/common/errors/app-error.ts': `export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode = 500,
    public readonly code = 'APP_ERROR',
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request') {
    super(message, 400, 'BAD_REQUEST')
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found') {
    super(message, 404, 'NOT_FOUND')
  }
}
`,
    'src/common/errors/index.ts': `export * from './app-error.js'
`,
    'src/common/handler/handle.ts': `import type { Request, Response, NextFunction } from 'express'

type Handler<T = unknown> = (req: Request) => Promise<T> | T

type HandleOptions = {
  status?: number
  message?: string
}

export function handle<T>(handler: Handler<T>, options: HandleOptions = {}) {
  const { status = 200, message } = options

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await handler(req)
      res.status(status).json({
        success: true,
        message,
        data,
      })
    } catch (error) {
      next(error)
    }
  }
}
`,
    'src/common/handler/index.ts': `export * from './handle.js'
`,
    'src/common/middleware/auth.ts': `import type { NextFunction, Request, Response } from 'express'

export type AuthenticatedRequest = Request & {
  user?: {
    userId: string
  }
}

export function authMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  // TODO: implement auth
  req.user = { userId: 'demo-user-id' }
  next()
}
`,
    'src/common/middleware/error-handler.ts': `import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../errors/index.js'

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError('Route not found', 404, 'NOT_FOUND'))
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      code: error.code,
      message: error.message,
    })
    return
  }

  res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
  })
}
`,
    'src/common/middleware/index.ts': `export * from './auth.js'
export * from './error-handler.js'
`,
    'src/common/utils/response.ts': `export function ok<T>(data: T, message?: string) {
  return {
    success: true,
    message,
    data,
  }
}
`,
    'src/common/utils/index.ts': `export * from './response.js'
`,
    'src/config/env.ts': `export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 3000),
}
`,
    'src/config/index.ts': `export * from './env.js'
`,
    'src/docs/index.ts': `import type { Express } from 'express'

export function registerDocs(_app: Express) {
  // TODO: wire openapi docs if needed
}
`,
    'src/infrastructure/db/client.ts': `export async function initDatabase() {
  // TODO: initialize db client
}
`,
    'src/infrastructure/db/index.ts': `export * from './client.js'
`,
    'src/infrastructure/queue/qstash.ts': `export async function enqueueTask() {
  // TODO: implement queue producer
}
`,
    'src/infrastructure/index.ts': `export * from './db/index.js'
export * from './queue/qstash.js'
`,
    'src/modules/README.md': `# modules

Feature modules live here. Each module follows:
- <name>.model.ts
- <name>.service.ts
- <name>.controller.ts
- <name>.routes.ts
`,
  }

  for (const [file, content] of Object.entries(files)) {
    await ensureFile(file, content)
  }
}

async function ensureReadmeForDirs() {
  const docs = {
    'src/common/README.md': '# common\n\nShared utilities and cross-cutting concerns.\n',
    'src/config/README.md': '# config\n\nEnvironment and app configuration.\n',
    'src/docs/README.md': '# docs\n\nOpenAPI/docs registration.\n',
    'src/infrastructure/README.md': '# infrastructure\n\nDatabase, queue, and external infrastructure adapters.\n',
    'src/tests/README.md': '# tests\n\nServer test suites.\n',
  }

  for (const [file, content] of Object.entries(docs)) {
    await ensureFile(file, content)
  }
}

async function ensureDirs() {
  for (const dir of BASE_DIRS) {
    await mkdir(dir, { recursive: true })
  }
}

function safeModuleName(input) {
  if (!input)
    return null

  const normalized = input.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
  if (!normalized)
    return null

  return normalized
}

function toClassName(name) {
  return name
    .split('-')
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join('')
}

async function scaffoldModule(moduleName) {
  const module = safeModuleName(moduleName)
  if (!module)
    throw new Error('Invalid module name. Use letters, numbers, and hyphens only.')

  const moduleDir = `src/modules/${module}`
  await mkdir(moduleDir, { recursive: true })

  const pascal = toClassName(module)

  const files = {
    [`${moduleDir}/README.md`]: `# ${module}\n\n${module} feature module.\n`,
    [`${moduleDir}/${module}.model.ts`]: `import { z } from 'zod'\n\nexport const create${pascal}Schema = z.object({\n  name: z.string().min(1),\n})\n\nexport type Create${pascal}Input = z.infer<typeof create${pascal}Schema>\n`,
    [`${moduleDir}/${module}.service.ts`]: `import type { Create${pascal}Input } from './${module}.model.js'\n\nexport async function list${pascal}Items() {\n  return []\n}\n\nexport async function create${pascal}Item(input: Create${pascal}Input) {\n  return { id: crypto.randomUUID(), ...input }\n}\n`,
    [`${moduleDir}/${module}.controller.ts`]: `import { Router } from 'express'\nimport { z } from 'zod'\nimport { handle } from '../../common/handler/index.js'\nimport { BadRequestError } from '../../common/errors/index.js'\nimport { create${pascal}Schema, type Create${pascal}Input } from './${module}.model.js'\nimport { list${pascal}Items, create${pascal}Item } from './${module}.service.js'\n\nconst router = Router()\n\nfunction validate(schema: z.ZodTypeAny) {\n  return (req: any, _res: any, next: any) => {\n    try {\n      req.body = schema.parse(req.body)\n      next()\n    } catch (error: any) {\n      next(new BadRequestError(error.errors?.[0]?.message || 'Validation failed'))\n    }\n  }\n}\n\nrouter.get('/', handle(async () => list${pascal}Items()))\n\nrouter.post('/', validate(create${pascal}Schema), handle(async (req) => {\n  return create${pascal}Item(req.body as Create${pascal}Input)\n}, { status: 201, message: '${module} created' }))\n\nexport default router\n`,
    [`${moduleDir}/${module}.routes.ts`]: `import router from './${module}.controller.js'\n\nexport default router\n`,
  }

  for (const [file, content] of Object.entries(files)) {
    await ensureFile(file, content)
  }

  console.log(`Module scaffolded: ${moduleDir}`)
  console.log(`Remember to register routes in src/app.ts, e.g. app.use('/api/${module}', ${module}Router)`)
}

async function ensurePreconditions() {
  if (!hasPnpm())
    throw new Error('pnpm is required but was not found in PATH')

  if (!await exists('package.json'))
    throw new Error('package.json was not found. Run this script at a project root.')
}

async function main() {
  await ensurePreconditions()

  run('pnpm', ['add', ...RUNTIME_DEPS])
  run('pnpm', ['add', '-D', ...DEV_DEPS])

  await ensurePackageJson()
  await ensureTsconfig()
  await ensureDirs()
  await ensureReadmeForDirs()
  await ensureBaseFiles()

  const moduleName = getArgValue('--module')
  if (moduleName)
    await scaffoldModule(moduleName)

  console.log('Express modular bootstrap completed')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
