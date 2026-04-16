#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { constants } from 'node:fs'
import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ICON_PLUGIN_IMPORT = "import { getIconCollections, iconsPlugin } from '@egoist/tailwindcss-icons'"

const ICON_PLUGIN_BLOCK = `iconsPlugin({
      collections: getIconCollections(['carbon', 'solar']),
    })`

const ICON_DEPS = [
  '@egoist/tailwindcss-icons',
  '@iconify-json/carbon',
  '@iconify-json/solar',
]

const CONFIG_CANDIDATES = [
  'tailwind.config.js',
  'tailwind.config.ts',
  'tailwind.config.mjs',
]

const CSS_CANDIDATES = [
  'app/globals.css',
  'src/styles/globals.css',
  'src/index.css',
  'src/main.css',
  'app.css',
  'global.css',
]

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

async function findFirstExisting(paths) {
  for (const entry of paths) {
    if (await exists(entry))
      return entry
  }
  return null
}

function parseMajor(versionRange) {
  if (!versionRange)
    return null

  const match = String(versionRange).match(/(\d+)/)
  if (!match)
    return null

  return Number.parseInt(match[1], 10)
}

async function ensurePreconditions() {
  if (!hasPnpm())
    throw new Error('pnpm is required but was not found in PATH')

  if (!await exists('package.json'))
    throw new Error('package.json was not found. Run this script at a project root.')

  const pkgRaw = await readFile('package.json', 'utf8')
  const pkg = JSON.parse(pkgRaw)

  const tailwindVersion =
    pkg?.dependencies?.tailwindcss
    || pkg?.devDependencies?.tailwindcss

  if (!tailwindVersion)
    throw new Error('tailwindcss dependency not found. Please install Tailwind CSS v4+ first.')

  const major = parseMajor(tailwindVersion)
  if (major === null || major < 4)
    throw new Error(`tailwindcss v4+ is required. Current: ${tailwindVersion}`)
}

function ensureImport(content) {
  if (content.includes(ICON_PLUGIN_IMPORT))
    return content

  const importLines = content.match(/^(import\s.+\n)+/)
  if (importLines && importLines[0])
    return `${importLines[0]}${ICON_PLUGIN_IMPORT}\n${content.slice(importLines[0].length)}`

  return `${ICON_PLUGIN_IMPORT}\n\n${content}`
}

function ensurePluginsSection(content) {
  if (content.includes('iconsPlugin('))
    return content

  const pluginsRegex = /plugins\s*:\s*\[(?<body>[\s\S]*?)\]/m
  const pluginsMatch = content.match(pluginsRegex)

  if (pluginsMatch && pluginsMatch.groups) {
    const body = pluginsMatch.groups.body.trim()
    const nextBody = body ? `${body},\n    ${ICON_PLUGIN_BLOCK}` : `\n    ${ICON_PLUGIN_BLOCK}\n  `
    return content.replace(pluginsRegex, `plugins: [${nextBody}]`)
  }

  const exportDefaultObjectRegex = /export\s+default\s+\{([\s\S]*)\}\s*$/m
  const exportMatch = content.match(exportDefaultObjectRegex)

  if (!exportMatch)
    throw new Error('Unsupported tailwind config format. Please use `export default { ... }` format.')

  const insertion = `\n  plugins: [\n    ${ICON_PLUGIN_BLOCK},\n  ],\n`
  const lastBraceIndex = content.lastIndexOf('}')
  if (lastBraceIndex === -1)
    throw new Error('Cannot update tailwind config.')

  return `${content.slice(0, lastBraceIndex)}${insertion}${content.slice(lastBraceIndex)}`
}

async function ensureTailwindConfig() {
  const configPath = await findFirstExisting(CONFIG_CANDIDATES)
  if (!configPath)
    throw new Error('tailwind.config.js/ts/mjs not found in project root.')

  let content = await readFile(configPath, 'utf8')
  const before = content

  content = ensureImport(content)
  content = ensurePluginsSection(content)

  if (content !== before)
    await writeFile(configPath, `${content.trimEnd()}\n`, 'utf8')

  return configPath
}

function normalizeRelativeForCss(fromDir, toFile) {
  let rel = path.relative(fromDir, toFile).replace(/\\/g, '/')
  if (!rel.startsWith('.'))
    rel = `./${rel}`
  return rel
}

function upsertCssDirective(lines, directivePrefix, fullDirective) {
  const index = lines.findIndex(line => line.trim().startsWith(directivePrefix))
  if (index >= 0)
    lines[index] = fullDirective
  else
    lines.push(fullDirective)
}

async function ensureCssDirectives(configPath) {
  const cssPath = await findFirstExisting(CSS_CANDIDATES)
  if (!cssPath)
    throw new Error(`No global css file found. Tried: ${CSS_CANDIDATES.join(', ')}`)

  const raw = await readFile(cssPath, 'utf8')
  const lines = raw.split(/\r?\n/)

  const relConfigPath = normalizeRelativeForCss(path.dirname(cssPath), configPath)

  upsertCssDirective(lines, '@config', `@config '${relConfigPath}';`)
  upsertCssDirective(lines, '@import \'tailwindcss\'', "@import 'tailwindcss';")
  upsertCssDirective(lines, '@plugin \'@egoist/tailwindcss-icons\'', "@plugin '@egoist/tailwindcss-icons';")

  const normalized = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
  await writeFile(cssPath, `${normalized}\n`, 'utf8')

  return cssPath
}

async function main() {
  await ensurePreconditions()

  run('pnpm', ['add', ...ICON_DEPS])

  const configPath = await ensureTailwindConfig()
  const cssPath = await ensureCssDirectives(configPath)

  console.log(`Updated tailwind config: ${configPath}`)
  console.log(`Updated css entry: ${cssPath}`)
  console.log('Icon usage example: <div class="i-solar-gallery-add-outline w-6 h-6"></div>')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
