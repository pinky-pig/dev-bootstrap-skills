#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { constants } from 'node:fs'
import { access, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline/promises'

const ROOT_KEEP_ENTRIES = new Set([
  '.git',
  '.github',
  '.vscode',
  '.idea',
  'node_modules',
  'apps',
  'packages',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'package.json',
  '.gitignore',
  '.npmrc',
  '.editorconfig',
  'README.md',
])

const ROOT_SCRIPT_DEFAULTS = {
  'dev:web': 'pnpm --filter web dev',
  'build:web': 'pnpm --filter web build',
  'start:web': 'pnpm --filter web start',
}

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

async function exists(file) {
  try {
    await access(file, constants.F_OK)
    return true
  }
  catch {
    return false
  }
}

async function readJson(file) {
  const raw = await readFile(file, 'utf8')
  return JSON.parse(raw)
}

async function writeJson(file, data) {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function getModeArg() {
  const args = process.argv.slice(2)

  const withEquals = args.find(arg => arg.startsWith('--mode='))
  if (withEquals)
    return withEquals.slice('--mode='.length)

  const index = args.indexOf('--mode')
  if (index >= 0 && args[index + 1])
    return args[index + 1]

  return null
}

function isLikelyFrontendPackage(pkg) {
  const dependencies = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  }

  const frameworkKeys = ['react', 'next', 'vue', 'vite', 'nuxt', 'svelte', 'astro']
  return frameworkKeys.some(key => Object.prototype.hasOwnProperty.call(dependencies, key))
}

async function hasFrontendRootFiles() {
  const candidates = [
    'src',
    'app',
    'public',
    'index.html',
    'vite.config.ts',
    'vite.config.js',
    'next.config.js',
    'next.config.mjs',
    'nuxt.config.ts',
  ]

  for (const entry of candidates) {
    if (await exists(entry))
      return true
  }

  return false
}

function toWorkspaceRootName(oldName) {
  if (!oldName)
    return 'workspace-root'

  if (oldName.includes('/')) {
    const parts = oldName.split('/')
    const last = parts[parts.length - 1]
    parts[parts.length - 1] = `${last}-workspace`
    return parts.join('/')
  }

  return `${oldName}-workspace`
}

async function ensureWorkspaceFile() {
  const workspacePath = 'pnpm-workspace.yaml'
  const required = ["  - 'apps/*'", "  - 'packages/*'"]

  if (!await exists(workspacePath)) {
    const content = `packages:\n${required.join('\n')}\n`
    await writeFile(workspacePath, content, 'utf8')
    return
  }

  let content = await readFile(workspacePath, 'utf8')

  if (!content.includes('packages:'))
    content = `packages:\n${content}`

  for (const line of required) {
    if (!content.includes(line)) {
      content = content.replace(/packages:\s*\n/, match => `${match}${line}\n`)
    }
  }

  await writeFile(workspacePath, content.trimEnd() + '\n', 'utf8')
}

async function ensureDirs() {
  await mkdir('apps', { recursive: true })
  await mkdir('packages', { recursive: true })
}

function mergeRootScripts(pkg) {
  pkg.scripts = pkg.scripts && typeof pkg.scripts === 'object' && !Array.isArray(pkg.scripts)
    ? pkg.scripts
    : {}

  for (const [key, value] of Object.entries(ROOT_SCRIPT_DEFAULTS)) {
    if (!pkg.scripts[key])
      pkg.scripts[key] = value
  }
}

async function ensureWebPlaceholder() {
  const appDir = path.join('apps', 'web')
  await mkdir(appDir, { recursive: true })

  const appPackagePath = path.join(appDir, 'package.json')
  if (!await exists(appPackagePath)) {
    const appPackage = {
      name: 'web',
      private: true,
      version: '0.0.0',
      scripts: {
        dev: 'echo "Please initialize your web app in apps/web"',
        build: 'echo "Please initialize your web app in apps/web"',
        start: 'echo "Please initialize your web app in apps/web"',
      },
    }

    await writeJson(appPackagePath, appPackage)
  }

  const readmePath = path.join(appDir, 'README.md')
  if (!await exists(readmePath))
    await writeFile(readmePath, '# web\n\nPlace your frontend app here.\n', 'utf8')
}

async function ensureInitMode() {
  await ensureWorkspaceFile()
  await ensureDirs()

  const rootPackage = await readJson('package.json')
  rootPackage.private = true
  if (!rootPackage.packageManager)
    rootPackage.packageManager = 'pnpm@10.33.0'

  mergeRootScripts(rootPackage)
  await writeJson('package.json', rootPackage)

  await ensureWebPlaceholder()
}

async function askConfirmMove(entries) {
  if (process.env.PNPM_MONOREPO_ASSUME_YES === '1')
    return true

  if (!process.stdin.isTTY || !process.stdout.isTTY)
    return false

  const preview = entries.slice(0, 10).join(', ')
  const suffix = entries.length > 10 ? ', ...' : ''

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await rl.question(`About to move ${entries.length} root entries into apps/web (${preview}${suffix}). Continue? (y/N): `)
    return ['y', 'yes'].includes(answer.trim().toLowerCase())
  }
  finally {
    rl.close()
  }
}

async function moveEntrySafe(src, dest) {
  await mkdir(path.dirname(dest), { recursive: true })

  try {
    await rename(src, dest)
  }
  catch {
    await cp(src, dest, { recursive: true, force: true })
    await rm(src, { recursive: true, force: true })
  }
}

async function collectMoveEntries() {
  const entries = await readdir('.', { withFileTypes: true })
  return entries
    .map(entry => entry.name)
    .filter(name => !ROOT_KEEP_ENTRIES.has(name))
}

async function writeWorkspaceRootPackage(oldPkg) {
  const rootPkg = {
    name: toWorkspaceRootName(oldPkg.name),
    private: true,
    version: oldPkg.version || '0.0.0',
    packageManager: oldPkg.packageManager || 'pnpm@10.33.0',
    scripts: {
      ...ROOT_SCRIPT_DEFAULTS,
    },
  }

  await writeJson('package.json', rootPkg)
}

async function migrateSingleProject() {
  const oldPkg = await readJson('package.json')

  await ensureWorkspaceFile()
  await ensureDirs()

  await mkdir(path.join('apps', 'web'), { recursive: true })

  const moveEntries = await collectMoveEntries()

  const canMove = await askConfirmMove(moveEntries)
  if (!canMove)
    throw new Error('Migration cancelled by user')

  const rootReadme = 'README.md'
  const appReadme = path.join('apps', 'web', 'README.md')
  if (await exists(rootReadme) && !await exists(appReadme)) {
    await moveEntrySafe(rootReadme, appReadme)
  }

  for (const name of moveEntries) {
    const src = path.join('.', name)
    const dest = path.join('apps', 'web', name)
    await moveEntrySafe(src, dest)
  }

  await writeJson(path.join('apps', 'web', 'package.json'), oldPkg)
  await writeWorkspaceRootPackage(oldPkg)

  if (!await exists('README.md')) {
    await writeFile('README.md', '# workspace\n\nMonorepo root. App source is in `apps/web`.\n', 'utf8')
  }
}

async function decideMode() {
  const explicitMode = getModeArg()
  if (explicitMode === 'init' || explicitMode === 'migrate')
    return explicitMode

  const hasWorkspace = await exists('pnpm-workspace.yaml')
  const hasWebAppPackage = await exists(path.join('apps', 'web', 'package.json'))

  if (hasWorkspace || hasWebAppPackage)
    return 'init'

  const pkg = await readJson('package.json')
  const looksLikeFrontend = isLikelyFrontendPackage(pkg) || await hasFrontendRootFiles()

  return looksLikeFrontend ? 'migrate' : 'init'
}

async function ensurePreconditions() {
  if (!hasPnpm())
    throw new Error('pnpm is required but was not found in PATH')

  if (!await exists('package.json'))
    throw new Error('package.json was not found. Run this script at a project root.')
}

async function main() {
  await ensurePreconditions()

  const mode = await decideMode()

  if (mode === 'migrate') {
    await migrateSingleProject()
    console.log('Monorepo migration completed (apps/web)')
    return
  }

  await ensureInitMode()
  console.log('Monorepo init/ensure completed (apps/web)')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
