import { expect, test } from '@playwright/test'
import cases from './draft-snapshot-cases.json' with { type: 'json' }
import { createFixtureRecoveryPayloads } from '../../src/internal-poc/fixture-adapter'
import { createSdk, TesiaApiClient } from '../../src/internal-poc/contracts/generated/api-v0.1'

// Contracts #28's unchanged mutation matrix, on the existing public fixture.
for (const scenario of cases.cases) test(`SDK rc2 Draft GET ${scenario.id}`, async () => {
  const { draft } = await createFixtureRecoveryPayloads('ef6bc3100d735654f2b933fee9ac6dd71883ab6bec07385f29b1412d87e96497')
  const data = structuredClone(draft) as unknown as Record<string, unknown>
  const parent = (path: string) => {
    const keys = path.split('.')
    let record = data
    for (const key of keys.slice(0, -1)) record = record[key] as Record<string, unknown>
    return { record, key: keys.at(-1)! }
  }
  for (const path of scenario.remove) { const { record, key } = parent(path); delete record[key] }
  for (const [path, value] of Object.entries(scenario.set)) { const { record, key } = parent(path); record[key] = value }
  const sdk = createSdk(new TesiaApiClient({
    request: async () => ({ status: 200, headers: { etag: '"etag_snapshot_synthetic_0001"' }, body: {
      meta: { apiContractVersion: '0.1.0', requestId: 'request_fixture_00000001', traceId: 'trace_fixture_00000001', resourceRevision: String(draft.revision) }, data,
    } }),
    openEventStream: async () => { throw new Error('UNEXPECTED_STREAM') },
  }))
  const response = sdk.conversation.draft({ id: draft.draftId })
  if (scenario.valid) expect((await response).body.data).toEqual(data)
  else await expect(response).rejects.toThrow('INVALID_OPERATION_RESPONSE_SCHEMA')
})
