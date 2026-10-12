import { createHash } from 'node:crypto';
import { link, lstat, mkdir, open, readFile, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROMPTS, PROMPT_REGISTRY_VERSION } from '../investment-prompts.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const sources = [
  '../investment-prompts.mjs',
  '../investment-response-preferences.mjs',
  '../investment-intent-admission.mjs',
];
const modes = ['settings', 'dialogue', 'judgment', 'report'];
const registryVersion = 'teth-investment-prompts-1.42.0';

export function validatePolicyRegistry(registry, version) {
  if (version !== registryVersion || !registry
    || Object.keys(registry).sort().join(',') !== modes.slice().sort().join(',')) {
    throw new Error('POLICY_REGISTRY_INVALID');
  }
  return modes.map(mode => {
    const policy = registry[mode];
    if (typeof policy?.text !== 'string' || typeof policy?.sha256 !== 'string'
      || policy.id !== `investment-${mode}-ko-1.42.0` || !policy.text.isWellFormed()) {
      throw new Error('POLICY_REGISTRY_INVALID');
    }
    const bytes = Buffer.from(policy.text, 'utf8');
    if (!bytes.length || bytes.length > 32768 || policy.text.normalize('NFC') !== policy.text
      || policy.text.includes('\0') || sha(bytes) !== policy.sha256) {
      throw new Error('POLICY_REGISTRY_INVALID');
    }
    return { mode, bytes, systemPrompt: {
      file: `investment-${mode}.prompt.txt`, revision: policy.id, sha256: policy.sha256,
    } };
  });
}

async function checkAncestors(parent) {
  let current = parent;
  for (;;) {
    const value = await lstat(current);
    if (!value.isDirectory() || value.isSymbolicLink()
      || ![0, process.geteuid()].includes(value.uid)
      || ((value.mode & 0o022) !== 0 && (value.mode & 0o1000) === 0)) {
      throw new Error('POLICY_ANCESTOR_UNTRUSTED');
    }
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
}

/** Prepare exact policy inputs, never credentials, configuration or activation. */
export async function exportConsultationPolicies(destination) {
  if (typeof destination !== 'string' || !path.isAbsolute(destination)
    || path.normalize(destination) !== destination || destination.endsWith(path.sep)
    || destination.includes('\0') || destination === path.parse(destination).root) {
    throw new Error('POLICY_DESTINATION_INVALID');
  }
  const parent = path.dirname(destination);
  const metadata = await lstat(parent);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()
    || await realpath(parent) !== parent || (metadata.mode & 0o777) !== 0o700
    || metadata.uid !== process.geteuid()) {
    throw new Error('POLICY_PARENT_NOT_OWNER_PRIVATE');
  }
  await checkAncestors(parent);
  // This release is intentionally pinned; changing policy versions needs review.
  // Validate every immutable input before creating any output directory.
  const entries = validatePolicyRegistry(PROMPTS, PROMPT_REGISTRY_VERSION);
  const sourceHashes = await Promise.all(sources.map(async relative => {
    const url = new URL(relative, import.meta.url);
    return { file: path.basename(fileURLToPath(url)), sha256: sha(await readFile(url)) };
  }));
  // Existing destinations (including symlinks) are never reused or overwritten.
  await mkdir(destination, { mode: 0o700 });
  const created = await lstat(destination);
  if (!created.isDirectory() || created.isSymbolicLink() || (created.mode & 0o777) !== 0o700
    || created.uid !== process.geteuid() || await realpath(destination) !== destination) {
    throw new Error('POLICY_DESTINATION_NOT_OWNER_PRIVATE');
  }
  const unchanged = async () => {
    const p = await lstat(parent), d = await lstat(destination);
    if (p.dev !== metadata.dev || p.ino !== metadata.ino || d.dev !== created.dev || d.ino !== created.ino
      || d.isSymbolicLink() || p.isSymbolicLink()) throw new Error('POLICY_DIRECTORY_CHANGED');
  };
  const writeExclusive = async (filename, bytes) => {
    await unchanged();
    const handle = await open(path.join(destination, filename), 'wx', 0o600);
    try {
      await handle.chmod(0o600); await handle.writeFile(bytes); await handle.sync();
    } finally { await handle.close(); }
  };
  for (const entry of entries) await writeExclusive(entry.systemPrompt.file, entry.bytes);
  const manifest = {
    format: 'teth-consultation-policy-inputs', registry: PROMPT_REGISTRY_VERSION,
    sourceHashScope: 'export-time-disk-reference-only-not-loaded-module-provenance',
    sourceHashes,
    policies: entries.map(({ mode, bytes, systemPrompt }) => ({ mode, bytes: bytes.length, systemPrompt })),
    runtimeScope: {
      exportDirectoryPrepared: true,
      installedToServer: false,
      dynamicPreferenceBuilderConnected: false,
      outputGateConnected: false,
      intentAdmissionConnected: false,
      displayParserConnected: false,
      providerCalled: false,
      serviceActivated: false,
    },
  };
  // Publish only a fully written, synced manifest; link is atomic and exclusive.
  // Existence alone is not acceptance: consumers must parse and recheck hashes.
  await writeExclusive('.policy-inputs.pending', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  await unchanged();
  await link(path.join(destination, '.policy-inputs.pending'), path.join(destination, 'policy-inputs.json'));
  try {
    await unlink(path.join(destination, '.policy-inputs.pending'));
    const directory = await open(destination, 'r');
    try { await directory.sync(); } finally { await directory.close(); }
    const parentHandle = await open(parent, 'r');
    try { await parentHandle.sync(); } finally { await parentHandle.close(); }
  } catch {
    // A published marker is NOT evidence that durability checks succeeded.
    throw new Error('POLICY_PUBLISHED_DURABILITY_UNCONFIRMED');
  }
  return manifest;
}

if (process.argv[1] && await realpath(process.argv[1]).catch(() => '')
  === await realpath(fileURLToPath(import.meta.url))) {
  if (process.argv.length !== 3) {
    process.stderr.write('Usage: node export-consultation-policies.mjs /absolute/private-parent/new-directory\n');
    process.exitCode = 2;
  } else {
    try {
      const manifest = await exportConsultationPolicies(process.argv[2]);
      process.stdout.write(JSON.stringify({ registry: manifest.registry, policies: manifest.policies,
        runtimeScope: manifest.runtimeScope }) + '\n');
    } catch (error) {
      // Avoid retaining filesystem/provider/input values in CLI diagnostics.
      const code = /^POLICY_[A-Z_]+$/.test(error?.message) ? error.message
        : error?.code === 'EEXIST' ? 'POLICY_DESTINATION_EXISTS' : 'POLICY_EXPORT_FAILED';
      process.stderr.write(code + '\n');
      process.exitCode = 1;
    }
  }
}
