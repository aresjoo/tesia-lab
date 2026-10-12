import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PROMPTS, PROMPT_REGISTRY_VERSION } from '../investment-prompts.mjs';
import { exportConsultationPolicies, validatePolicyRegistry } from '../tools/export-consultation-policies.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
// Independent release anchors: changing text while retaining 1.42.0 must fail.
const golden = {
  settings: [28191, 'ef4f8302b45ba2e81d8eb7615e30d2ee1566e686cf054ea8f6d4a9a475d02a5e'],
  dialogue: [31764, '97c58bd00b1398194d545018d24a7ac5cd7f9bf3ec91c6f6a439c4e32471bb86'],
  judgment: [28415, '5040c0ee8c33cfcb014177a8a48b9a79e4e9dde593a858b238f5c747b41a14c3'],
  report: [29163, '2a74b0efd3e6d6a40b2eefac955ff207f16b3ba229a9c512f25fdebc86615f24'],
};
async function temporary(t) {
  const parent = await realpath(await mkdtemp(path.join(os.tmpdir(), 'teth-policy-export-')));
  t.after(() => rm(parent, { recursive: true, force: true }));
  await chmod(parent, 0o700);
  return parent;
}

test('four pinned 1.42 source policies export byte-exact with file/revision/sha256 keys', async t => {
  const parent = await temporary(t), directory = path.join(parent, 'inputs');
  const manifest = await exportConsultationPolicies(directory);
  assert.equal(manifest.registry, 'teth-investment-prompts-1.42.0');
  assert.equal(manifest.policies.length, 4);
  assert.deepEqual(manifest.policies.map(p=>p.mode).sort(), ['dialogue','judgment','report','settings']);
  assert.deepEqual((await readdir(directory)).sort(), ['policy-inputs.json', ...manifest.policies.map(p => p.systemPrompt.file)].sort());
  assert.equal((await lstat(directory)).mode & 0o777, 0o700);
  for (const entry of manifest.policies) {
    assert.deepEqual(Object.keys(entry.systemPrompt).sort(), ['file', 'revision', 'sha256']);
    const bytes = await readFile(path.join(directory, entry.systemPrompt.file));
    assert.deepEqual(bytes, Buffer.from(PROMPTS[entry.mode].text));
    assert.equal(entry.bytes, bytes.length);
    assert.equal(entry.systemPrompt.revision, PROMPTS[entry.mode].id);
    assert.equal(hash(bytes), entry.systemPrompt.sha256);
    assert.deepEqual([bytes.length, hash(bytes)], golden[entry.mode]);
    assert.ok(bytes.length <= 32768);
    assert.equal((await lstat(path.join(directory, entry.systemPrompt.file))).mode & 0o777, 0o600);
  }
  assert.equal((await lstat(path.join(directory, 'policy-inputs.json'))).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'policy-inputs.json'), 'utf8')), manifest);
  for (const source of manifest.sourceHashes) {
    assert.equal(source.sha256, hash(await readFile(new URL('../' + source.file, import.meta.url))));
  }
  assert.equal(manifest.sourceHashScope, 'export-time-disk-reference-only-not-loaded-module-provenance');
  assert.deepEqual(manifest.sourceHashes.map(p=>p.file), ['investment-prompts.mjs',
    'investment-response-preferences.mjs','investment-intent-admission.mjs']);
  assert.deepEqual(manifest.runtimeScope, {exportDirectoryPrepared:true,installedToServer:false,
    dynamicPreferenceBuilderConnected:false,outputGateConnected:false,intentAdmissionConnected:false,
    displayParserConnected:false,providerCalled:false,serviceActivated:false});
});

test('latest registry rejects old release, cost tiers, extra modes, bad identity/text/NFC/checksum before export', () => {
  const check = registry => validatePolicyRegistry(registry, PROMPT_REGISTRY_VERSION);
  for(const registry of [{}, {...PROMPTS, '../escape':PROMPTS.dialogue},
    {cheap:PROMPTS.dialogue,standard:PROMPTS.dialogue,deep:PROMPTS.report}]) {
    assert.throws(()=>check(registry), {message:'POLICY_REGISTRY_INVALID'});
  }
  assert.throws(()=>validatePolicyRegistry(PROMPTS,'teth-investment-prompts-1.24.0'),
    {message:'POLICY_REGISTRY_INVALID'});
  for(const delta of [{id:'investment-dialogue-ko-1.24.0'}, {text:undefined}, {text:''},
    {text:'x'.repeat(32769)}, {text:'e\u0301'}, {text:'x\0y'}, {text:'\ud800'},
    {sha256:'0'.repeat(64)}]) {
    const edited = {...PROMPTS.dialogue,...delta};
    if (typeof delta.text === 'string') edited.sha256 = hash(Buffer.from(delta.text));
    assert.throws(()=>check({...PROMPTS,dialogue:edited}), {message:'POLICY_REGISTRY_INVALID'});
  }
  const boundary = '가'.repeat(10922) + 'xx';
  assert.equal(Buffer.byteLength(boundary),32768);
  assert.equal(check({...PROMPTS,dialogue:{...PROMPTS.dialogue,text:boundary,
    sha256:hash(Buffer.from(boundary))}})[1].bytes.length,32768);
});

test('CLI exports once, repeat outputs are deterministic, and existing destinations are never overwritten', async t => {
  const parent=await temporary(t), bin=path.join(parent,'bin'), script=path.join(bin,'export.mjs');
  await mkdir(bin,{mode:0o700});
  await symlink(new URL('../tools/export-consultation-policies.mjs',import.meta.url),script);
  const {stdout}=await promisify(execFile)(process.execPath,[script,path.join(parent,'a')]);
  assert.equal(JSON.parse(stdout).policies.length,4);
  await exportConsultationPolicies(path.join(parent,'b'));
  assert.deepEqual((await readdir(path.join(parent,'a'))).sort(),(await readdir(path.join(parent,'b'))).sort());
  for (const name of await readdir(path.join(parent,'a'))) {
    assert.deepEqual(await readFile(path.join(parent,'a',name)), await readFile(path.join(parent,'b',name)));
  }
  const before = await readFile(path.join(parent,'a','policy-inputs.json'));
  await assert.rejects(promisify(execFile)(process.execPath,[script,path.join(parent,'a')]),
    error=>error.code===1 && error.stderr==='POLICY_DESTINATION_EXISTS\n');
  assert.deepEqual(await readFile(path.join(parent,'a','policy-inputs.json')),before);
  await assert.rejects(promisify(execFile)(process.execPath,[script]),{code:2});
});

test('relative/root/traversal, non-private and symlink parents are rejected', async t => {
  const parent = await temporary(t);
  for (const value of ['relative', '/', parent + '/x/../y', parent + '/']) {
    await assert.rejects(exportConsultationPolicies(value), { message: 'POLICY_DESTINATION_INVALID' });
  }
  const shared = path.join(parent, 'shared'); await mkdir(shared, { mode: 0o755 }); await chmod(shared, 0o755);
  await assert.rejects(exportConsultationPolicies(path.join(shared, 'inputs')), { message: 'POLICY_PARENT_NOT_OWNER_PRIVATE' });
  const link = path.join(parent, 'link'); await symlink(parent, link);
  await assert.rejects(exportConsultationPolicies(path.join(link, 'inputs')), { message: 'POLICY_PARENT_NOT_OWNER_PRIVATE' });
});

test('an existing symlink destination cannot change its target', async t => {
  const parent = await temporary(t), target = path.join(parent, 'target');
  await mkdir(target, { mode: 0o700 });
  const link = path.join(parent, 'inputs'); await symlink(target, link);
  await assert.rejects(exportConsultationPolicies(link), { code: 'EEXIST' });
  assert.deepEqual(await readdir(target), []);
  assert.equal((await lstat(link)).isSymbolicLink(), true);
});

test('nonsticky writable ancestors reject while an owner-private child under sticky ancestors works', async t => {
  const parent=await temporary(t), shared=path.join(parent,'shared'), child=path.join(shared,'private');
  await mkdir(shared,{mode:0o777}); await chmod(shared,0o777);
  await mkdir(child,{mode:0o700}); await chmod(child,0o700);
  await assert.rejects(exportConsultationPolicies(path.join(child,'inputs')),
    {message:'POLICY_ANCESTOR_UNTRUSTED'});
  await assert.rejects(lstat(path.join(child,'inputs')),{code:'ENOENT'});
  await chmod(shared,0o1777);
  assert.equal((await exportConsultationPolicies(path.join(child,'inputs'))).policies.length,4);
});
