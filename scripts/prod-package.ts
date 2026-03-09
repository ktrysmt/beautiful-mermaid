import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

const decoder = new TextDecoder()

export interface ProdPackageInfo {
  cacheDir: string
  packageRoot: string
  packageVersion: string
  tarballPath: string
}

export interface PrepareProdOptions {
  refresh?: boolean
}

function run(cmd: string[], cwd: string): string {
  const proc = Bun.spawnSync({ cmd, cwd, stdout: 'pipe', stderr: 'pipe' })
  const stdout = decoder.decode(proc.stdout).trim()
  const stderr = decoder.decode(proc.stderr).trim()

  if (proc.exitCode !== 0) {
    throw new Error([
      `Command failed (${proc.exitCode}): ${cmd.join(' ')}`,
      stdout && `stdout:\n${stdout}`,
      stderr && `stderr:\n${stderr}`,
    ].filter(Boolean).join('\n\n'))
  }

  return stdout
}

function tryReadCachedInfo(metadataPath: string): ProdPackageInfo | null {
  if (!existsSync(metadataPath)) return null
  try {
    const parsed = JSON.parse(readFileSync(metadataPath, 'utf8')) as ProdPackageInfo
    if (!parsed.packageRoot || !parsed.packageVersion || !parsed.tarballPath) return null
    if (!existsSync(join(parsed.packageRoot, 'dist', 'index.js'))) return null
    if (!existsSync(join(parsed.packageRoot, 'package.json'))) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Downloads and extracts the latest published beautiful-mermaid package.
 *
 * Output folder: <repo>/.cache/prod-compare/
 */
export function prepareLatestProdPackage(
  rootDir: string,
  options: PrepareProdOptions = {},
): ProdPackageInfo {
  const cacheDir = join(rootDir, '.cache', 'prod-compare')
  const packDir = join(cacheDir, 'pack')
  const extractDir = join(cacheDir, 'extract')
  const metadataPath = join(cacheDir, 'metadata.json')

  if (!options.refresh) {
    const cached = tryReadCachedInfo(metadataPath)
    if (cached) return cached
  }

  rmSync(packDir, { recursive: true, force: true })
  rmSync(extractDir, { recursive: true, force: true })
  mkdirSync(packDir, { recursive: true })
  mkdirSync(extractDir, { recursive: true })

  const packOutput = run(
    ['npm', 'pack', 'beautiful-mermaid@latest', '--silent', '--pack-destination', packDir],
    rootDir,
  )

  const tarballName = packOutput.split(/\r?\n/).map(s => s.trim()).filter(Boolean).at(-1)
  if (!tarballName) {
    throw new Error(`Could not parse tarball name from npm pack output: ${packOutput}`)
  }

  const tarballPath = join(packDir, tarballName)
  if (!existsSync(tarballPath)) {
    throw new Error(`Tarball not found at expected path: ${tarballPath}`)
  }

  run(['tar', '-xzf', tarballPath, '-C', extractDir], rootDir)

  const packageRoot = join(extractDir, 'package')
  const packageJsonPath = join(packageRoot, 'package.json')
  if (!existsSync(packageJsonPath)) {
    throw new Error(`Extracted package.json not found: ${packageJsonPath}`)
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: string }
  if (!packageJson.version) {
    throw new Error(`Extracted package has no version in ${packageJsonPath}`)
  }

  const info: ProdPackageInfo = {
    cacheDir,
    packageRoot,
    packageVersion: packageJson.version,
    tarballPath,
  }

  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(metadataPath, JSON.stringify(info, null, 2))

  return info
}

if (import.meta.main) {
  const rootDir = process.cwd()
  const info = prepareLatestProdPackage(rootDir, {
    refresh: process.argv.includes('--refresh'),
  })
  console.log(JSON.stringify(info, null, 2))
}
