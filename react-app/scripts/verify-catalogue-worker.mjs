/** Verify the isolated production build, not only the Vite development worker.
 * Usage: node scripts/verify-catalogue-worker.mjs /absolute/build/worker
 * Build root must contain catalogue-preview.js and its generated assets.
 * --account additionally verifies catalogue-account.js with session persistence.
 */
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { chromium } from '@playwright/test'

if (!process.argv[2] || !path.isAbsolute(process.argv[2])) throw Error('An absolute isolated build directory is required')
const root = path.resolve(process.argv[2]), repo = fileURLToPath(new URL('..', import.meta.url))
await readFile(path.join(root, 'catalogue-preview.js'))
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost')
    if (url.pathname === '/') {
      response.setHeader('Content-Type', 'text/html')
      response.end('<!doctype html><title>Catalogue worker verification</title>')
      return
    }
    const file = path.resolve(root, '.' + url.pathname)
    if (!file.startsWith(root + path.sep)) { response.writeHead(404); response.end(); return }
    const body = await readFile(file)
    response.setHeader('Content-Type', 'application/javascript')
    response.end(body)
  } catch { response.writeHead(404); response.end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  browser = await chromium.launch()
  const page = await browser.newPage(), errors = [], requestFailures = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('requestfailed', r => requestFailures.push(r.url()))
  await page.goto('http://127.0.0.1:' + server.address().port)
  const expected = []
  for (const file of ['catalogue-spot-golden.json', 'catalogue-futures-golden.json', 'catalogue-window-golden.json']) expected.push(...JSON.parse(await readFile(path.join(repo, 'tests/fixtures', file), 'utf8')).rows)
  const output = await page.evaluate(async rows => {
    const path = '/catalogue-preview.js', { createCataloguePreviewClient } = await import(path)
    const client = createCataloguePreviewClient()
    try {
      const results = []
      for (let offset = 0; offset < rows.length; offset += 31) results.push(...await Promise.all(rows.slice(offset, offset + 31).map(async r => {
        const value = await client.run(r.id, r.period)
        const judgments = value.judgments
        return { id: value.strategy.id, period: value.period, n: value.result.n, ret: value.result.ret, startI: value.result.params.startI, source: value.source,
          judgmentsValid: Array.isArray(judgments) && judgments.length >= 2 && judgments.length <= 8 && judgments[0].k === 'now' && judgments.at(-1).k === 'intro'
            && judgments.every(m => typeof m.t === 'string' && m.t.length > 0 && !/undefined|NaN|Infinity/.test(m.t) && Number.isSafeInteger(m.i)) }
      })))
      const copies = []
      for (const [k, row] of rows.filter(r => r.period === 'all').entries()) {
        const full = await client.run(row.id, 'all'), startI = full.result.params.endI - 100
        const record = { model: 'catalogue-units-preview', owner: 'production-worker-check', id: 'copy-' + row.id,
          binding: { sourceSha: full.sourceSha, strategyId: row.id, spotVersion: full.dataVersion.spot, futuresVersion: full.dataVersion.futures, ...full.calendar },
          startI, settings: { amount: 1000, loss: -20, cap: 95, existing: k % 2 ? 'copy' : 'skip' }, status: 'active',
          ledger: [{ at: 1, i: startI, type: 'add', amount: 1000 }, { at: 2, i: startI + 10, type: 'add', amount: 250 }, { at: 3, i: startI + 35, type: 'out', amount: 25 }], flats: [startI + 15, startI + 35] }
        if (k % 3 === 1) record.stopI = startI + 50
        if (k % 3 === 2) { record.status = 'closed'; record.endI = startI + 80 }
        const indices = [startI, startI + 35, full.result.params.endI]
        copies.push({ record, indices, projection: await client.copy(record.owner, record, indices) })
      }
      return { results, copies }
    } finally { client.dispose() }
  }, expected.map(r => ({ id: r.id, period: r.period })))
  for (const result of output.results) {
    const source = expected.find(e => e.id === result.id && e.period === result.period)
    assert.ok(source)
    assert.equal(result.n, source.n); assert.equal(result.ret, source.ret); assert.equal(result.startI, source.startI)
    assert.equal(result.source, 'client-snapshot-preview')
    assert.equal(result.judgmentsValid, true, `${result.id}/${result.period}: missing or invalid judgment summaries`)
  }
  const json = async file => JSON.parse(await readFile(path.join(repo, file), 'utf8'))
  const spot = await json('src/client-catalogue-spot-data.json'), future = await json('src/client-catalogue-futures-data.json'), definitions = await json('src/client-catalogue-source.json')
  const context = vm.createContext({ TETH_PX: spot, TETH_FUT: future, PRICE0: spot.px['비트코인'], MK_UNI: definitions.universes, mkPx: k => spot.px[k], cpMeta: () => ({ share: .1 }) })
  context.window = context
  for (const name of ['catalogue-source-runtime', 'catalogue-futures-runtime', 'catalogue-copy-runtime']) vm.runInContext((await json('tests/fixtures/' + name + '.json')).code, context, { timeout: 1000 })
  vm.runInContext('function tfSSFind(){return {kind:config.kind,r:original}}', context)
  for (const { record, indices, projection } of output.copies) {
    context.config = definitions.catalogue.find(c => c.id === record.binding.strategyId)
    context.copy = { nick: record.binding.strategyId, simStartI: record.startI, status: record.status, adv: record.settings, flats: record.flats, stopI: record.stopI, endI: record.endI, ledger: record.ledger.map(e => ({ ...e, amt: e.amount })) }
    context.indices = indices
    const original = JSON.parse(vm.runInContext('var original=mkRunCfg(config); var answer=cpCalc(copy); JSON.stringify({calculation:Object.fromEntries(Object.entries(answer).filter(([k])=>k!=="at")),observations:indices.map(i=>({i,value:answer.at(i)}))})', context, { timeout: 3000 }))
    assert.deepEqual(projection.calculation, original.calculation); assert.deepEqual(projection.observations, original.observations)
    assert.equal(projection.owner, record.owner); assert.equal(projection.copyId, record.id)
    assert.deepEqual(projection.binding, record.binding)
    assert.ok(projection.limitations.includes('RISK_SETTINGS_NOT_ENFORCED'))
  }
  let accountLifecycle = 'not-requested'
  if (process.argv.includes('--account')) {
    await readFile(path.join(root, 'catalogue-account.js'))
    const account = await page.evaluate(async () => {
      const path = '/catalogue-account.js', { createCatalogueCopyAccountController } = await import(path)
      const c = createCatalogueCopyAccountController('production-preview')
      try {
        const started = await c.start({ id: 'production-copy', strategyId: 'd1', settings: { amount: 500, loss: -20, existing: 'copy', cap: 95 }, at: 1000 })
        const before = c.getSnapshot().state
        const closed = await c.stop('production-copy', 'now', 2000), after = c.getSnapshot().state
        const repeated = await c.stop('production-copy', 'now', 3000), unchanged = JSON.stringify(after) === JSON.stringify(c.getSnapshot().state)
        const restored = createCatalogueCopyAccountController('production-preview')
        try { return { started, before, closed, after, repeated, unchanged, restored: restored.getSnapshot().state } } finally { restored.dispose() }
      } finally { c.dispose() }
    })
    assert.equal(account.started.ok, true); assert.equal(account.closed.ok, true); assert.equal(account.repeated.ok, true)
    assert.equal(account.unchanged, true); assert.deepEqual(account.restored, account.after)
    const c = account.before.copies[0].record
    context.config = definitions.catalogue.find(c => c.id === 'd1')
    context.copy = { nick: 'd1', simStartI: c.startI, status: 'closed', endI: spot.px['비트코인'].length - 1, adv: c.settings, flats: [], ledger: c.ledger.map(e => ({ ...e, amt: e.amount })) }
    const original = JSON.parse(vm.runInContext('original=mkRunCfg(config);answer=cpCalc(copy);JSON.stringify({back:Math.max(0,answer.est),net:answer.net,share:answer.share})', context, { timeout: 3000 }))
    assert.deepEqual(account.after.copies[0].settlement, { at: 2000, ...original })
    assert.equal(account.after.spot, 500 + original.back)
    accountLifecycle = 'PASS'
  }
  assert.deepEqual(errors, []); assert.deepEqual(requestFailures, [])
  console.log(JSON.stringify({ productionModule: 'PASS', sourceCombinations: output.results.length, judgmentSummaries: 'PASS', sourceCopyComparisons: output.copies.length, accountLifecycle, consoleErrors: errors.length, failedRequests: requestFailures.length }))
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}
