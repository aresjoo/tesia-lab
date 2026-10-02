/** Explicitly confirmed LOCAL PREVIEW recovery only, never wallet authority.
 * The caller supplies a new crypto.randomUUID() and invokes this only from its
 * confirmation action. No automatic invocation, deletion, clock or randomness.
 */
import { createCopyPreviewState, type CopyPreviewState } from './client-copy-preview-state'
import { copyPreviewStorageKey, saveCopyPreviewState, type CopyPreviewStorage, type CopyPreviewStoreError } from './client-copy-preview-store'

export type CopyPreviewRecoveryError = 'invalid-owner' | 'invalid-recovery-id' | 'storage-unavailable' | 'read-failed'
  | 'archive-too-large' | 'archive-exists' | 'archive-read-failed' | 'archive-write-failed' | 'archive-readback-failed'
  | 'source-changed' | 'reset-failed'
export type CopyPreviewRecoveryResult = { ok: true; state: CopyPreviewState; archiveKey: string | null }
  | { ok: false; error: CopyPreviewRecoveryError; archiveKey: string | null; message: string; retryRead: boolean; saveError?: CopyPreviewStoreError }
const messages: Record<CopyPreviewRecoveryError, string> = {
  'invalid-owner': '현재 계정을 다시 확인해주세요.',
  'invalid-recovery-id': '복구 요청을 새로 열어 다시 확인해주세요.',
  'storage-unavailable': '이 브라우저에서 미리보기 저장소를 사용할 수 없어요.',
  'read-failed': '기존 미리보기를 읽지 못해 초기화하지 않았어요. 다시 불러와 확인해주세요.',
  'archive-too-large': '기존 미리보기가 보관 한도를 넘어 초기화하지 않았어요. 원본은 그대로 남아 있어요.',
  'archive-exists': '같은 복구 요청의 보관함이 이미 있어요. 다시 불러온 뒤 새 복구 요청을 확인해주세요.',
  'archive-read-failed': '보관함을 확인하지 못해 초기화하지 않았어요.',
  'archive-write-failed': '기존 미리보기의 사본 저장을 확인하지 못해 초기화하지 않았어요. 원본은 그대로 남아 있어요.',
  'archive-readback-failed': '보관 사본을 다시 읽어 확인하지 못해 초기화하지 않았어요. 원본은 그대로 남아 있어요.',
  'source-changed': '복구 중 미리보기가 바뀌어 초기화하지 않았어요. 다시 불러와 확인해주세요.',
  'reset-failed': '초기화 결과를 확인하지 못했어요. 다시 불러와 현재 상태를 확인해주세요.',
}
const fail = (error: CopyPreviewRecoveryError, archiveKey: string | null = null, saveError?: CopyPreviewStoreError): CopyPreviewRecoveryResult => ({
  ok: false, error, archiveKey, message: messages[error],
  retryRead: ['read-failed', 'archive-exists', 'source-changed', 'reset-failed'].includes(error),
  ...(saveError ? { saveError } : {}),
})

export function archiveAndResetCopyPreview(owner: string, recoveryId: string, storage?: CopyPreviewStorage): CopyPreviewRecoveryResult {
  let primaryKey: string
  try { primaryKey = copyPreviewStorageKey(owner) } catch { return fail('invalid-owner') }
  if (typeof recoveryId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(recoveryId)) return fail('invalid-recovery-id')
  let port: CopyPreviewStorage
  try { port = storage ?? sessionStorage } catch { return fail('storage-unavailable') }
  let raw: string | null
  try { raw = port.getItem(primaryKey) } catch { return fail('read-failed') }
  let archiveKey: string | null = null
  if (raw !== null) {
    // No truncation, reserialization, normalization or parsing of damaged bytes.
    if (typeof raw !== 'string' || raw.length > 2_000_000 || new TextEncoder().encode(raw).byteLength > 2_000_000) return fail('archive-too-large')
    const candidate = `teth-copy-preview-recovery:${encodeURIComponent(owner)}:${recoveryId}`
    try { if (port.getItem(candidate) !== null) return fail('archive-exists') }
    catch { return fail('archive-read-failed') }
    // Once setItem is attempted, its key is retained even if the adapter throws
    // after writing. Never claim that a throw proved the write did not occur.
    archiveKey = candidate
    try { port.setItem(archiveKey, raw) } catch { return fail('archive-write-failed', archiveKey) }
    try { if (port.getItem(archiveKey) !== raw) return fail('archive-readback-failed', archiveKey) }
    catch { return fail('archive-readback-failed', archiveKey) }
  }
  // An injected adapter or another writer may have changed the primary during
  // archival. Preserve that newer value rather than resetting an unarchived one.
  try { if (port.getItem(primaryKey) !== raw) return fail('source-changed', archiveKey) }
  catch { return fail('read-failed', archiveKey) }
  const state = createCopyPreviewState(owner), saved = saveCopyPreviewState(state, port)
  return saved.ok ? { ok: true, state, archiveKey } : fail('reset-failed', archiveKey, saved.error)
}
