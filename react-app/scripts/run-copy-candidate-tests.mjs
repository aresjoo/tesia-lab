import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const candidateTestFiles = Object.freeze([
  'tests/copy-execution/candidate-fixture.test.ts',
  'tests/copy-execution/controller.test.ts',
  'tests/copy-execution/money.test.ts',
  'tests/copy-execution/transport.test.ts',
])

export function requireCandidateInputs(projectRoot) {
  for (const file of [...candidateTestFiles, 'tests/copy-execution/tsconfig.json']) {
    const path = join(projectRoot, file)
    if (!existsSync(path) || !statSync(path).isFile()) {
      throw new Error(`COPY_CANDIDATE_INPUT_MISSING:${file}`)
    }
  }
}

export function runCompiledNodeTests(testFiles, { projectRoot, nodeExecutable = process.execPath } = {}) {
  const child = spawnSync(nodeExecutable, [
    '--test', '--experimental-test-isolation=none', '--test-reporter=tap', ...testFiles,
  ], { cwd: projectRoot, stdio: 'inherit', timeout: 60_000, killSignal: 'SIGTERM' })
  if (child.error) throw child.error
  if (child.signal || !Number.isInteger(child.status)) {
    throw new Error(`COPY_CANDIDATE_CHILD_INCOMPLETE:${child.signal ?? 'NO_EXIT_STATUS'}`)
  }
  return child.status
}

export function runCopyCandidateTests(projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  requireCandidateInputs(projectRoot)
  const localDependencies = join(projectRoot, 'node_modules')
  const explicitDependencies = process.env.TETH_TEST_NODE_MODULES
  const dependencyRoot = existsSync(localDependencies) ? localDependencies
    : explicitDependencies && existsSync(explicitDependencies) ? resolve(explicitDependencies) : null
  if (!dependencyRoot) throw new Error('TEST_NODE_MODULES_UNAVAILABLE')
  const dependencyRequire = createRequire(join(dependencyRoot, 'package.json'))
  const ts = dependencyRequire('typescript')
  const configPath = join(projectRoot, 'tests/copy-execution/tsconfig.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))

  const outputRoot = mkdtempSync(join(tmpdir(), 'teth-copy-candidate-node-'))
  try {
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath), {
      rootDir: projectRoot,
      outDir: outputRoot,
      typeRoots: [join(dependencyRoot, '@types')],
      noEmitOnError: true,
    }, configPath)
    const expectedTests = candidateTestFiles.map(file => join(projectRoot, file)).sort()
    const includedTests = parsed.fileNames.filter(file => file.endsWith('.test.ts')).sort()
    if (JSON.stringify(includedTests) !== JSON.stringify(expectedTests)) {
      throw new Error('COPY_CANDIDATE_TEST_INPUT_SET_MISMATCH')
    }
    const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options })
    const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)]
    if (diagnostics.length) {
      process.stderr.write(ts.formatDiagnostics(diagnostics, {
        getCanonicalFileName: file => file,
        getCurrentDirectory: () => projectRoot,
        getNewLine: () => '\n',
      }))
      throw new Error('COPY_CANDIDATE_COMPILE_FAILED')
    }
    if (program.emit().emitSkipped) throw new Error('COPY_CANDIDATE_EMIT_SKIPPED')
    writeFileSync(join(outputRoot, 'package.json'), '{"type":"module"}\n', { flag: 'wx' })
    const emittedTests = candidateTestFiles.map(file => join(outputRoot, file.replace(/\.ts$/, '.js')))
    for (const file of emittedTests) {
      if (!existsSync(file)) throw new Error('COPY_CANDIDATE_EMITTED_TEST_MISSING')
    }
    process.stdout.write(`COPY_CANDIDATE_COMPILED files=${emittedTests.length} typescript=${ts.version}\n`)
    return runCompiledNodeTests(emittedTests, { projectRoot })
  } finally {
    rmSync(outputRoot, { recursive: true, force: true })
    process.stdout.write(`COPY_CANDIDATE_TEMP_CLEANED ${outputRoot}\n`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runCopyCandidateTests()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
