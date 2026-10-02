import { ApiResponseError } from './contracts/generated/api-v0.1/client'

export type ServiceIssue = Readonly<{
  title: string
  description: string
  diagnosticCode: string
  requiresSessionRecovery: boolean
}>

const issue = (
  title: string,
  description: string,
  diagnosticCode: string,
  requiresSessionRecovery = false,
): ServiceIssue => ({ title, description, diagnosticCode, requiresSessionRecovery })

/**
 * Converts transport and adapter failures into safe UI state.  Responses,
 * cookies, CSRF values, URLs, and server-provided error text never cross this
 * boundary; the diagnostic code is deliberately from this local allowlist.
 */
export const describeServiceIssue = (reason: unknown, fallback: string): ServiceIssue => {
  if (reason instanceof ApiResponseError && reason.status === 401) {
    return issue(
      '세션을 다시 확인해야 합니다.',
      '세션 상태를 확인할 수 없으며, 요청한 작업 중 일부가 이미 실행되었을 수 있습니다.',
      'SESSION_REAUTH_REQUIRED',
      true,
    )
  }
  if (reason instanceof ApiResponseError) {
    // Fixed display text only: never render the server's message, details or headers.
    if (reason.status === 403) return issue(
      '요청 권한을 확인해주세요.',
      '요청이 허용되지 않았습니다. 계정 권한 또는 요청의 보안 정보를 확인해야 합니다.',
      'REQUEST_FORBIDDEN',
    )
    if (reason.status === 409 || reason.status === 412) return issue(
      '요청 상태 충돌',
      '현재 화면 상태와 요청 정보가 일치하지 않습니다. 진행 상태를 확인한 뒤 이어가주세요.',
      'REQUEST_STATE_CONFLICT',
    )
    if (reason.status === 429) return issue(
      '요청 한도 초과',
      '짧은 시간에 요청이 몰려 처리가 일시적으로 제한되었습니다.',
      'REQUEST_RATE_LIMITED',
    )
    if (reason.status >= 500 && reason.status <= 599) return issue(
      '서버 응답 이상',
      '서버 응답이 비정상적이어서 작업의 실제 반영 여부를 즉시 확인할 수 없습니다.',
      'SERVER_RESPONSE_UNCONFIRMED',
    )
  }
  if (reason instanceof TypeError || (reason instanceof DOMException && reason.name === 'AbortError')) {
    return issue(
      'Owner-local 서비스에 연결할 수 없습니다.',
      '로컬 서비스가 응답하지 않거나 브라우저가 연결을 차단했습니다. 요청 결과를 추측하지 않습니다.',
      'OWNER_LOCAL_NETWORK_UNAVAILABLE',
      true,
    )
  }
  const code = reason instanceof Error ? reason.message : fallback
  if (code === 'LOCAL_RECOVERY_STORAGE_UNAVAILABLE') return issue(
    '진행 정보 저장 실패',
    '다음 단계를 이어가려면 승인 재개 정보가 기기에 저장되어야 하지만 저장하지 못했습니다.',
    code,
  )
  if (code === 'BROWSER_SESSION_UNCONFIRMED') {
    return issue(
      '세션을 안전하게 확인하지 못했습니다.',
      '브라우저와 owner-local 서비스의 세션 왕복을 확인할 수 없어 화면을 열지 않았습니다.',
      code,
      true,
    )
  }
  if (code === 'LOGOUT_RESPONSE_UNCONFIRMED') {
    return issue(
      '로그아웃 결과를 확인하지 못했습니다.',
      '서버가 해제 상태를 확인해 줄 때까지 현재 화면과 로컬 상태를 유지합니다.',
      code,
      true,
    )
  }
  return issue(
    '내부 서비스 설정을 검증하지 못했습니다.',
    '신뢰할 수 없는 설정 또는 응답으로 실제 API 모드를 열지 않았습니다.',
    /^[A-Z][A-Z0-9_]{2,120}$/.test(code) ? code : fallback,
  )
}
