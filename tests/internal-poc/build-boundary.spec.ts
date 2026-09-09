import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'

const execFileAsync = promisify(execFile)

const listFiles = async (root: string, current: string = root): Promise<string[]> => {
  const entries = await readdir(current, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(current, entry.name)
    return entry.isDirectory() ? listFiles(root, path) : [relative(root, path)]
  }))
  return nested.flat().sort()
}

const javascriptText = async (root: string, files: readonly string[]): Promise<string> => {
  const chunks = await Promise.all(files
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFile(join(root, file), 'utf8')))
  return chunks.join('\n')
}

test('기본 build와 internal POC build 산출 디렉터리를 물리적으로 분리한다', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'tesia-web-build-boundary-'))
  const publicOutput = join(temporary, 'public-dist')
  const internalOutput = join(temporary, 'internal-dist')

  try {
    await execFileAsync('npm', ['run', 'build', '--', '--outDir', publicOutput], {
      cwd: process.cwd(),
      timeout: 120_000,
    })
    const publicFiles = await listFiles(publicOutput)
    expect(publicFiles).toContain('index.html')
    expect(publicFiles).not.toContain('internal-poc.html')
    expect(publicFiles).not.toContain('internal-poc-fixture.html')
    expect(await javascriptText(publicOutput, publicFiles)).not.toContain('LOCAL_STRATEGY_BACKTEST_VERTICAL')
    expect(await javascriptText(publicOutput, publicFiles)).not.toContain('LOCAL_RECORDED_PAPER_SESSION')
    expect(await javascriptText(publicOutput, publicFiles)).not.toContain('LOCAL_MARKET_ARTIFACT_CATALOG')
    expect(await javascriptText(publicOutput, publicFiles)).not.toContain('/internal/poc/market-artifacts')
    expect(await javascriptText(publicOutput, publicFiles)).not.toContain('SERVICE_V03_MOCK_JOURNEY_MEMORY_ONLY')
    expect(await javascriptText(publicOutput, publicFiles)).not.toContain('입력과 무관한 고정 계약 fixture 시연')
    expect(await javascriptText(publicOutput, publicFiles)).not.toContain('#/v03-journey')
    expect(await javascriptText(publicOutput, publicFiles)).not.toContain('client-service-app')
    expect(await javascriptText(publicOutput, publicFiles)).not.toContain('chart-workspace-preview')
    expect(await javascriptText(publicOutput, publicFiles)).not.toContain('TEST_ONLY_PRICE_VIEW')
    expect(await javascriptText(publicOutput, publicFiles)).not.toContain('렌더러 검증용 합성 입력')

    await execFileAsync('npm', ['run', 'build:internal-poc', '--', '--outDir', internalOutput], {
      cwd: process.cwd(),
      timeout: 120_000,
    })
    const internalFiles = await listFiles(internalOutput)
    expect(internalFiles).toContain('internal-poc.html')
    expect(internalFiles).toContain('internal-poc-fixture.html')
    expect(internalFiles).not.toContain('index.html')
    const internalHtml = await readFile(join(internalOutput, 'internal-poc.html'), 'utf8')
    expect(internalHtml).toContain('href="/teth-logo.png"')
    expect(internalHtml).toContain('name="tesia-owner-local-service-url" content=""')
    for (const file of internalFiles.filter(file => /ClientServiceExperience-.*\.(js|css)$/.test(file))) {
      expect(internalHtml).toContain(`href="/${file}"`)
    }
    expect(internalHtml.toLowerCase()).not.toContain('fixture')
    expect(await javascriptText(internalOutput, internalFiles)).toContain('LOCAL_STRATEGY_BACKTEST_VERTICAL')
    expect(await javascriptText(internalOutput, internalFiles)).toContain('LOCAL_RECORDED_PAPER_SESSION')
    expect(await javascriptText(internalOutput, internalFiles)).toContain('LOCAL_MARKET_ARTIFACT_CATALOG')
    expect(await javascriptText(internalOutput, internalFiles)).toContain('/internal/poc/market-artifacts')
    expect(await javascriptText(internalOutput, internalFiles)).toContain('SERVICE_V03_MOCK_JOURNEY_MEMORY_ONLY')
    expect(await javascriptText(internalOutput, internalFiles)).toContain('입력과 무관한 고정 계약 fixture 시연')
    expect(await javascriptText(internalOutput, internalFiles)).toContain('#/v03-journey')

    const publicFilesAfterInternalBuild = await listFiles(publicOutput)
    expect(publicFilesAfterInternalBuild).toEqual(publicFiles)
    expect(await javascriptText(publicOutput, publicFilesAfterInternalBuild)).not.toContain('LOCAL_STRATEGY_BACKTEST_VERTICAL')
    expect(await javascriptText(publicOutput, publicFilesAfterInternalBuild)).not.toContain('LOCAL_RECORDED_PAPER_SESSION')
    expect(await javascriptText(publicOutput, publicFilesAfterInternalBuild)).not.toContain('LOCAL_MARKET_ARTIFACT_CATALOG')
    expect(await javascriptText(publicOutput, publicFilesAfterInternalBuild)).not.toContain('/internal/poc/market-artifacts')
    expect(await javascriptText(publicOutput, publicFilesAfterInternalBuild)).not.toContain('SERVICE_V03_MOCK_JOURNEY_MEMORY_ONLY')
    expect(await javascriptText(publicOutput, publicFilesAfterInternalBuild)).not.toContain('입력과 무관한 고정 계약 fixture 시연')
    expect(await javascriptText(publicOutput, publicFilesAfterInternalBuild)).not.toContain('#/v03-journey')
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
