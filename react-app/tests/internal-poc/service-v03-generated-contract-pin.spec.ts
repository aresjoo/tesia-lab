import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { API_V03_UPSTREAM } from '../../src/internal-poc/contracts/generated/api-v0.3/upstream'

const generatedRoot = resolve('src/internal-poc/contracts/generated/api-v0.3')
const recordedTrace = resolve('tests/fixtures/service-v03/recorded-conversation.json')
const sha256 = (value: Buffer): string => createHash('sha256').update(value).digest('hex')

test('Contracts API v0.3 생성물과 recorded trace가 병합 정본에 고정된다', async () => {
  const manifestBytes = await readFile(resolve(generatedRoot, 'generation-manifest.json'))
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as {
    apiContractVersion: string
    packageVersion: string
    generatedSha256: Readonly<Record<string, string>>
    sourceSha256: Readonly<Record<string, string>>
  }

  expect(API_V03_UPSTREAM.commitSha).toBe('0f1920a71513322baaad9b29d756f0b0d3f5b095')
  expect(API_V03_UPSTREAM.treeSha).toBe('7915ad24dbf9f1d16397b8b72f8a87a628cb382d')
  expect(API_V03_UPSTREAM.wheelSha256).toBe('e9a8a401e0c2437eb42a528730810b08a6a5dcca00744e10f2a9ddb09b155e5f')
  expect(manifest.apiContractVersion).toBe('0.3.0')
  expect(manifest.packageVersion).toBe(API_V03_UPSTREAM.packageVersion)
  expect(sha256(manifestBytes)).toBe(API_V03_UPSTREAM.generationManifestSha256)

  for (const name of ['index.ts', 'sdk.ts', 'types.ts', 'operation-manifest.json'] as const) {
    expect(sha256(await readFile(resolve(generatedRoot, name))), name).toBe(manifest.generatedSha256[name])
  }

  const exactClient = await readFile(resolve(generatedRoot, 'client.ts.upstream.txt'))
  expect(sha256(exactClient)).toBe(manifest.generatedSha256['client.ts'])
  const runtimeClient = await readFile(resolve(generatedRoot, 'client.ts'), 'utf8')
  const upstreamClient = exactClient.toString('utf8')
  const upstreamCast = 'operation.errorStatusByCode as Readonly<Record<ErrorCode,number>>'
  const runtimeCast = 'operation.errorStatusByCode as unknown as Readonly<Record<ErrorCode,number>>'
  expect(sha256(Buffer.from(upstreamCast))).toBe(API_V03_UPSTREAM.patchedUpstreamCastSha256)
  expect(upstreamClient.includes(upstreamCast)).toBe(true)
  expect(runtimeClient.includes(runtimeCast)).toBe(true)
  expect(runtimeClient.replace(runtimeCast, upstreamCast)).toBe(upstreamClient)

  const traceBytes = await readFile(recordedTrace)
  expect(sha256(traceBytes)).toBe(API_V03_UPSTREAM.positiveTraceSha256)
  expect(manifest.sourceSha256['fixtures/api/v0_3/positive-conversation-trace.json'])
    .toBe(API_V03_UPSTREAM.positiveTraceSha256)
})

test('v0.3 operation manifest는 8개 정본 operation 외 호출을 허용하지 않는다', async () => {
  const manifest = JSON.parse(await readFile(resolve(generatedRoot, 'operation-manifest.json'), 'utf8')) as {
    operations: ReadonlyArray<{ operationId: string }>
  }
  expect(manifest.operations.map((operation) => operation.operationId)).toEqual([
    'createConversationV3',
    'getConversationV3',
    'createConversationTurnV3',
    'getStrategyDraftV3',
    'patchStrategyDraftV3',
    'validateStrategyDraftV3',
    'createApprovalChallengeV3',
    'approveStrategyDraftV3',
  ])
})
