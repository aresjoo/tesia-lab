export type PaperUiIssue = Readonly<{
  title: string
  description: string
  diagnosticCode: PaperUiDiagnosticCode
}>

export type PaperUiDiagnosticCode =
  | 'PAPER_CONNECTION_UNAVAILABLE'
  | 'PAPER_INPUT_REQUIRED'
  | 'PAPER_REQUEST_RECOVERY_REQUIRED'
  | 'PAPER_RECORD_UNTRUSTED'
  | 'PAPER_RESULT_UNAVAILABLE'
  | 'PAPER_OPERATION_UNAVAILABLE'
  | 'PAPER_EXECUTION_UNAVAILABLE'
  | 'PAPER_CATALOG_CONNECTION_UNAVAILABLE'
  | 'PAPER_CATALOG_CHANGED'
  | 'PAPER_CATALOG_UNTRUSTED'
  | 'PAPER_CATALOG_UNAVAILABLE'

const issue = (
  title: string,
  description: string,
  diagnosticCode: PaperUiDiagnosticCode,
): PaperUiIssue => ({ title, description, diagnosticCode })

const INPUT_REQUIRED_CODES = new Set([
  'PAPER_MARKET_ARTIFACT_SELECTION_REQUIRED',
  'PAPER_MARKET_ARTIFACT_START_BINDING_UNAVAILABLE',
])

const REQUEST_RECOVERY_CODES = new Set([
  'PAPER_API_ACTIVE_SESSION_DISCARD_REQUIRED',
  'PAPER_API_PENDING_REQUEST_BINDING_MISMATCH',
  'PAPER_API_PENDING_REQUEST_INVALID',
  'PAPER_API_PENDING_REQUEST_PERSIST_FAILED',
  'PAPER_API_CSRF_MISSING',
])

const RECORD_UNTRUSTED_CODES = new Set([
  'PAPER_API_ACTIVE_SESSION_BINDING_MISMATCH',
  'PAPER_API_ACTIVE_STRATEGY_BINDING_MISMATCH',
  'PAPER_API_ARTIFACT_AUTHORITY_INVALID',
  'PAPER_API_ARTIFACT_AUTHORITY_MISMATCH',
  'PAPER_API_ARTIFACT_BINDING_INVALID',
  'PAPER_API_CANONICAL_VALUE_INVALID',
  'PAPER_API_COVERAGE_INVALID',
  'PAPER_API_CROSS_RESOURCE_BINDING_MISMATCH',
  'PAPER_API_DATA_INVALID',
  'PAPER_API_ENVELOPE_INVALID',
  'PAPER_API_ERROR_ENVELOPE_INVALID',
  'PAPER_API_EXECUTION_INVALID',
  'PAPER_API_EXTERNAL_EFFECTS_INVALID',
  'PAPER_API_HTTP_STATUS_INVALID',
  'PAPER_API_JSON_INVALID',
  'PAPER_API_JSON_RESPONSE_REQUIRED',
  'PAPER_API_LEDGER_INVALID',
  'PAPER_API_META_INVALID',
  'PAPER_API_POINTER_INVALID',
  'PAPER_API_PROVENANCE_INVALID',
  'PAPER_API_REPLAY_PREIMAGE_INVALID',
  'PAPER_API_REPORT_BINDING_INVALID',
  'PAPER_API_REPORT_INVALID',
  'PAPER_API_REPORT_PROVENANCE_INVALID',
  'PAPER_API_REQUESTED_STRATEGY_INVALID',
  'PAPER_API_RESPONSE_TOO_LARGE',
  'PAPER_API_RESTART_INVALID',
  'PAPER_API_RESULT_AVAILABLE_INVALID',
  'PAPER_API_RESULT_HASHES_INVALID',
  'PAPER_API_RESULT_HASHES_MISSING',
  'PAPER_API_RESULT_INTEGRITY_INVALID',
  'PAPER_API_RESULT_INVALID',
  'PAPER_API_SAME_ORIGIN_REQUIRED',
  'PAPER_API_SESSION_BINDING_MISMATCH',
  'PAPER_API_STATUS_BINDING_INVALID',
  'PAPER_API_STATUS_INVALID',
  'PAPER_RECORDED_FIXTURE_STRATEGY_MISMATCH',
  'PAPER_UI_CURSOR_INVALID',
  'PAPER_UI_CURSOR_MISSING',
  'PAPER_UI_REQUESTED_STRATEGY_BINDING_MISMATCH',
  'PAPER_UI_SESSION_ID_MISMATCH',
  'PAPER_UI_SNAPSHOT_INVALID',
])

const CATALOG_UNTRUSTED_CODES = new Set([
  'PAPER_MARKET_ARTIFACT_AUTHORITY_INVALID',
  'PAPER_MARKET_ARTIFACT_CATALOG_INVALID',
  'PAPER_MARKET_ARTIFACT_DATA_CLASS_INVALID',
  'PAPER_MARKET_ARTIFACT_DATA_INVALID',
  'PAPER_MARKET_ARTIFACT_ENVELOPE_INVALID',
  'PAPER_MARKET_ARTIFACT_ERROR_ENVELOPE_INVALID',
  'PAPER_MARKET_ARTIFACT_HTTP_STATUS_INVALID',
  'PAPER_MARKET_ARTIFACT_ITEM_INVALID',
  'PAPER_MARKET_ARTIFACT_JSON_INVALID',
  'PAPER_MARKET_ARTIFACT_JSON_REQUIRED',
  'PAPER_MARKET_ARTIFACT_META_INVALID',
  'PAPER_MARKET_ARTIFACT_RESPONSE_TOO_LARGE',
])

const reasonCode = (reason: unknown): string => reason instanceof Error ? reason.message : ''

const isConnectionFailure = (reason: unknown): boolean => (
  reason instanceof TypeError
  || (typeof DOMException !== 'undefined' && reason instanceof DOMException && reason.name === 'AbortError')
)

/**
 * Converts Paper adapter failures into fixed browser-safe copy. The returned
 * object never contains the original error, response text, URL, cookie, CSRF
 * value, or server-provided failure code.
 */
export const describePaperSessionIssue = (reason: unknown): PaperUiIssue => {
  if (isConnectionFailure(reason)) {
    return issue(
      'Owner-local 서비스에 연결할 수 없습니다.',
      '연결이 끊겼거나 응답을 확인하지 못했습니다. 실행 결과를 추측하지 않습니다.',
      'PAPER_CONNECTION_UNAVAILABLE',
    )
  }

  const code = reasonCode(reason)
  if (INPUT_REQUIRED_CODES.has(code)) {
    return issue(
      'Paper 실행 입력을 먼저 확인해 주세요.',
      '사용할 기록 artifact를 선택하고 실행 가능한 상태인지 확인해 주세요.',
      'PAPER_INPUT_REQUIRED',
    )
  }
  if (REQUEST_RECOVERY_CODES.has(code)) {
    return issue(
      '이전 Paper 요청을 먼저 정리해야 합니다.',
      '보존된 요청 상태를 재전송하거나 명시적으로 폐기한 뒤 다시 진행해 주세요.',
      'PAPER_REQUEST_RECOVERY_REQUIRED',
    )
  }
  if (code === 'PAPER_RECORDED_ARTIFACT_AUTHORITY_MISSING') {
    return issue(
      '신뢰할 수 있는 Paper 결과가 없습니다.',
      '출처와 결속된 결과가 없어 terminal 결과와 성과를 표시하지 않습니다.',
      'PAPER_RESULT_UNAVAILABLE',
    )
  }
  if (RECORD_UNTRUSTED_CODES.has(code)) {
    return issue(
      'Paper 기록의 무결성을 확인하지 못했습니다.',
      '전략, 입력 또는 실행 결과의 결속을 신뢰할 수 없어 표시를 중단했습니다.',
      'PAPER_RECORD_UNTRUSTED',
    )
  }
  return issue(
    'Paper 기록 상태를 확인하지 못했습니다.',
    '예상하지 못한 응답으로 현재 결과를 표시하지 않습니다.',
    'PAPER_OPERATION_UNAVAILABLE',
  )
}

export const describePaperExecutionFailure = (): PaperUiIssue => issue(
  'Owner-local Paper 실행이 완료되지 않았습니다.',
  '엔진이 실패 상태를 반환했습니다. 내부 실패 정보는 화면에 표시하지 않습니다.',
  'PAPER_EXECUTION_UNAVAILABLE',
)

export const describePaperCatalogIssue = (reason: unknown): PaperUiIssue => {
  if (isConnectionFailure(reason)) {
    return issue(
      'Owner-local artifact 목록에 연결할 수 없습니다.',
      '로컬 서비스의 목록 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      'PAPER_CATALOG_CONNECTION_UNAVAILABLE',
    )
  }

  const code = reasonCode(reason)
  if (code === 'PAPER_MARKET_ARTIFACT_AUTHORITY_CHANGED') {
    return issue(
      '선택한 artifact가 변경되었습니다.',
      '기존 선택과 보존된 요청을 해제했습니다. 최신 목록에서 다시 선택해 주세요.',
      'PAPER_CATALOG_CHANGED',
    )
  }
  if (CATALOG_UNTRUSTED_CODES.has(code)) {
    return issue(
      'Artifact 목록의 무결성을 확인하지 못했습니다.',
      '응답 형식이나 출처 결속을 신뢰할 수 없어 선택을 중단했습니다.',
      'PAPER_CATALOG_UNTRUSTED',
    )
  }
  return issue(
    'Artifact 목록을 불러오지 못했습니다.',
    '목록 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    'PAPER_CATALOG_UNAVAILABLE',
  )
}
