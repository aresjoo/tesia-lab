import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const generatedRoot = resolve('src/internal-poc/contracts/generated/api-v0.1')

const sha256 = (value: Buffer): string => createHash('sha256').update(value).digest('hex')

test('Contracts API v0.1 generated snapshot이 upstream manifest hash와 일치한다', async () => {
  const manifestBytes = await readFile(resolve(generatedRoot, 'generated-manifest.json'))
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as {
    packageVersion: string
    generatedSha256: Readonly<Record<string, string>>
  }

  expect(manifest.packageVersion).toBe('0.8.0-rc.2')
  expect(sha256(manifestBytes)).toBe('391e9a907baa5d483c403b9d66d1bbb7ee6f021c7202c41c352ffa5aba56ac5a')

  const exactClient = await readFile(resolve(generatedRoot, 'client.ts.upstream.txt'))
  expect(sha256(exactClient)).toBe(manifest.generatedSha256['client.ts'])

  for (const name of ['index.ts', 'sdk.ts', 'types.ts', 'operation-manifest.json'] as const) {
    const bytes = await readFile(resolve(generatedRoot, name))
    expect(sha256(bytes), name).toBe(manifest.generatedSha256[name])
  }
})

test('실행 client는 재현된 단일 cast만 type-only로 교정한다', async () => {
  const runtime = await readFile(resolve(generatedRoot, 'client.ts'), 'utf8')
  const exact = await readFile(resolve(generatedRoot, 'client.ts.upstream.txt'), 'utf8')
  const upstreamLine = '  const statusByCode = operation.errorStatusByCode as Readonly<Record<string, number>>;\n'
  const runtimeLine = '  const statusByCode = operation.errorStatusByCode as unknown as Readonly<Record<string, number>>;\n'
  expect(sha256(Buffer.from(upstreamLine))).toBe('ad86f7f2b086272cf487106ecfd833b0b7f0caf1de319491b0d1ce30d81e89df')
  expect(exact.includes(upstreamLine)).toBe(true)
  expect(runtime.includes(runtimeLine)).toBe(true)
  expect(runtime.replace(runtimeLine, upstreamLine)).toBe(exact)
})
