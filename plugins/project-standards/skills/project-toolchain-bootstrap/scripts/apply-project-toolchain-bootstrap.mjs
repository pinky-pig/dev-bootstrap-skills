#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { constants } from 'node:fs'
import { access, copyFile, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import readline from 'node:readline/promises'

const DEV_DEPENDENCIES = [
  'eslint',
  '@arvinn/eslint-config',
  '@arvinn/prettier-config',
  '@arvinn/vscode-settings',
  'lint-staged',
  'simple-git-hooks',
]

const SETUP_SCRIPT = 'pnpm up @arvinn/eslint-config @arvinn/prettier-config @arvinn/vscode-settings && npx arvinn-vscode-settings'

const ESLINT_TEMPLATE = `import { arvinn } from '@arvinn/eslint-config'

export default arvinn(
  {
    unocss: false,
    vue: true,
  },
  {
    rules: {
      'unused-imports/no-unused-vars': 'off',
      'node/prefer-global/process': 'off',
      'import/no-default-export': 'off',
      'import-x/no-default-export': 'off',
    },
  },
)
`

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
  const result = spawnSync('pnpm', ['--version'], {
    stdio: 'ignore',
  })
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

function ensureObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return value
  return {}
}

function updatePrepareScript(scripts) {
  const prepare = typeof scripts.prepare === 'string' ? scripts.prepare.trim() : ''

  if (!prepare) {
    scripts.prepare = 'simple-git-hooks'
    return
  }

  if (!prepare.includes('simple-git-hooks'))
    scripts.prepare = `${prepare} && simple-git-hooks`
}

async function updatePackageJson() {
  const raw = await readFile('package.json', 'utf8')
  const pkg = JSON.parse(raw)

  pkg.scripts = ensureObject(pkg.scripts)
  pkg.scripts['setup-arvin'] = SETUP_SCRIPT
  updatePrepareScript(pkg.scripts)

  pkg.prettier = '@arvinn/prettier-config'

  pkg['simple-git-hooks'] = ensureObject(pkg['simple-git-hooks'])
  pkg['simple-git-hooks']['pre-commit'] = 'pnpm lint-staged || true'

  pkg['lint-staged'] = ensureObject(pkg['lint-staged'])
  pkg['lint-staged']['*'] = 'eslint --fix --no-warn-ignored'

  await writeFile('package.json', `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
}

async function askForOverwrite(file) {
  if (
    process.env.PROJECT_TOOLCHAIN_ASSUME_YES === '1'
    || process.env.JS_TOOLCHAIN_ASSUME_YES === '1'
    || process.env.DEV_BOOTSTRAP_ASSUME_YES === '1'
  )
    return true

  if (!process.stdin.isTTY || !process.stdout.isTTY)
    return false

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await rl.question(`eslint config exists and does not use @arvinn/eslint-config. Overwrite ${file}? (y/N): `)
    return ['y', 'yes'].includes(answer.trim().toLowerCase())
  }
  finally {
    rl.close()
  }
}

async function ensureEslintConfig() {
  const file = 'eslint.config.ts'

  if (!await exists(file)) {
    await writeFile(file, ESLINT_TEMPLATE, 'utf8')
    console.log('Created eslint.config.ts')
    return
  }

  const current = await readFile(file, 'utf8')
  if (current.includes('@arvinn/eslint-config')) {
    console.log('eslint.config.ts already uses @arvinn/eslint-config, skipping overwrite')
    return
  }

  const shouldOverwrite = await askForOverwrite(file)
  if (!shouldOverwrite) {
    console.log('Skipped eslint.config.ts overwrite')
    return
  }

  await copyFile(file, `${file}.bak`)
  await writeFile(file, ESLINT_TEMPLATE, 'utf8')
  console.log('Backed up eslint.config.ts to eslint.config.ts.bak and wrote Arvinn template')
}

function ensurePreconditions() {
  if (!hasPnpm())
    throw new Error('pnpm is required but was not found in PATH')

  const packageJsonExists = spawnSync('node', ['-e', "process.exit(require('node:fs').existsSync('package.json') ? 0 : 1)"])
  if (packageJsonExists.status !== 0)
    throw new Error('package.json was not found. Run this script at a project root.')
}

async function main() {
  ensurePreconditions()

  run('pnpm', ['add', '-D', ...DEV_DEPENDENCIES])

  await updatePackageJson()
  await ensureEslintConfig()

  run('pnpm', ['exec', 'simple-git-hooks'])
  run('npx', ['arvinn-vscode-settings'])

  console.log('JS toolchain bootstrap completed')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
