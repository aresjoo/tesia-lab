import './fixtures/retry-guard-register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { constructorOptions, dispatches, resetRetryGuardFixture } from './fixtures/retry-guard-sdk.mjs';

const origin = 'http://localhost:4500';
const parse = (text) => text.split('\n').filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice(6)));
const payload = (scenario) => ({ messages: [{ role: 'user', content: JSON.stringify(scenario) }] });
let workerIsolate = 0;

async function unusedPort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

async function workerRoute(body, extraEnv = {}) {
  const worker = (await import(`../worker.mjs?retry-guard-isolate=${++workerIsolate}`)).default;
  const start = dispatches.length;
  const pending = [];
  const response = await worker.fetch(new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': `retry-guard-${crypto.randomUUID()}` },
    body: JSON.stringify(body),
  }), {
    ANTHROPIC_API_KEY: 'strict-fixture-only',
    TETH_AI_GATEWAY: 'http://localhost/strict-fixture',
    ...extraEnv,
  }, { waitUntil(promise) { pending.push(promise); } });
  const events = parse(await response.text());
  await Promise.all(pending);
  return { events, calls: dispatches.slice(start) };
}

test('Node and Worker SDK constructors explicitly disable internal retries', async (t) => {
  assert.equal(existsSync(new URL('../.env', import.meta.url)), false, 'PRIVATE_ENV_NOT_ALLOWED_FOR_FIXTURE');
  resetRetryGuardFixture();
  const workerResult = await workerRoute(payload({ caseId: 'constructor-worker' }));
  assert.equal(workerResult.calls.length, 1);
  assert.equal(constructorOptions.at(-1).maxRetries, 0);

  const temp = mkdtempSync(join(tmpdir(), 'teth-retry-guard-node-'));
  const receipt = join(temp, 'sdk-receipt.json');
  const port = await unusedPort();
  const child = spawn(process.execPath, [
    '--import', fileURLToPath(new URL('./fixtures/retry-guard-register.mjs', import.meta.url)),
    fileURLToPath(new URL('../index.mjs', import.meta.url)),
  ], {
    cwd: temp,
    env: {
      TETH_AI_PORT: String(port),
      ANTHROPIC_API_KEY: 'strict-fixture-only',
      TETH_RETRY_GUARD_RECEIPT: receipt,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
    rmSync(temp, { recursive: true, force: true });
  });
  let logs = '';
  child.stdout.on('data', (value) => { logs += value; });
  const started = Date.now();
  while (!logs.includes('http://localhost:')) {
    if (child.exitCode !== null || Date.now() - started > 5000) throw new Error('STRICT_NODE_FIXTURE_START_FAILED');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const nodeReceipt = JSON.parse(readFileSync(receipt, 'utf8'));
  assert.equal(nodeReceipt.constructorOptions.length, 1);
  assert.equal(nodeReceipt.constructorOptions[0].maxRetries, 0);
});

for (const status of [400, 403, 429]) {
  for (const stage of ['pre-output', 'posttext', 'posttoolstop']) {
    test(`Worker status ${status} at ${stage} dispatches once and terminates incomplete`, async () => {
      resetRetryGuardFixture();
      const result = await workerRoute(payload({
        caseId: `${status}-${stage}`,
        failStatus: status,
        failStage: stage,
      }), { TETH_AI_SPEED: 'fast' });

      assert.equal(result.calls.length, 1);
      assert.equal(result.calls[0].params.speed, 'fast');
      assert.equal(result.events.filter((event) => event.done).length, 0);
      assert.equal(result.events.filter((event) => event.error).length, 1);
      assert.equal(result.events.filter((event) => event.usage).length, 0);
      assert.ok(!result.events.some((event) => event.text?.includes('대체 응답')));
      if (stage === 'posttext') assert.ok(result.events.some((event) => event.text?.includes('부분 응답은 보존됩니다.')));
      if (stage === 'posttoolstop') assert.ok(result.events.some((event) => event.tool?.q === '관측된 부분 도구 요청'));
    });
  }
}

for (const stage of ['pre-output', 'posttext', 'posttoolstop']) {
  test(`Worker standard speed status 403 at ${stage} dispatches once and terminates incomplete`, async () => {
    resetRetryGuardFixture();
    const result = await workerRoute(payload({
      caseId: `standard-403-${stage}`,
      failStatus: 403,
      failStage: stage,
    }));

    assert.equal(result.calls.length, 1);
    assert.equal(result.calls[0].params.speed, undefined);
    assert.equal(result.events.filter((event) => event.done).length, 0);
    assert.equal(result.events.filter((event) => event.error).length, 1);
    assert.equal(result.events.filter((event) => event.usage).length, 0);
    assert.ok(!result.events.some((event) => event.text?.includes('대체 응답')));
    if (stage === 'posttext') assert.ok(result.events.some((event) => event.text?.includes('부분 응답은 보존됩니다.')));
    if (stage === 'posttoolstop') assert.ok(result.events.some((event) => event.tool?.q === '관측된 부분 도구 요청'));
  });
}

test('Worker preserves pause_turn and tool_result continuation', async () => {
  resetRetryGuardFixture();
  const result = await workerRoute(payload({
    caseId: 'normal-continuation',
    sequence: [
      { stop: 'pause_turn', chunks: ['계속 처리합니다.'] },
      { stop: 'tool_use', chunks: [], toolUse: { name: 'unapproved_order', id: 'unsupported-tool', input: { symbol: 'BTCUSDT' } } },
      { stop: 'end_turn', chunks: ['지원하지 않는 도구라 실행하지 않았습니다.'] },
    ],
  }));
  assert.equal(result.calls.length, 3);
  assert.ok(result.events.at(-1).done);
  assert.equal(result.events.at(-1).usage.in, 30);
  assert.equal(result.events.at(-1).usage.out, 60);
  const toolResult = result.calls[2].params.messages.at(-1).content[0];
  assert.equal(toolResult.type, 'tool_result');
  assert.equal(toolResult.is_error, true);
  assert.equal(JSON.parse(toolResult.content).code, 'UNKNOWN_TOOL');
});

test('Worker permits six actual SDK dispatches and never creates a seventh', async () => {
  resetRetryGuardFixture();
  const six = await workerRoute(payload({
    caseId: 'six-dispatches',
    sequence: [
      ...Array.from({ length: 5 }, (_, index) => ({ stop: 'pause_turn', chunks: [`pause-${index}`] })),
      { stop: 'end_turn', chunks: ['sixth-complete'] },
    ],
  }));
  assert.equal(six.calls.length, 6);
  assert.equal(six.events.filter((event) => event.done).length, 1);
  assert.equal(six.events.filter((event) => event.error).length, 0);

  resetRetryGuardFixture();
  const seventh = await workerRoute(payload({
    caseId: 'seventh-blocked',
    sequence: [
      ...Array.from({ length: 6 }, (_, index) => ({ stop: 'pause_turn', chunks: [`pause-${index}`] })),
      { stop: 'end_turn', chunks: ['must-not-dispatch'] },
    ],
  }));
  assert.equal(seventh.calls.length, 6);
  assert.equal(seventh.events.filter((event) => event.done).length, 0);
  assert.equal(seventh.events.filter((event) => event.error).length, 1);
});
