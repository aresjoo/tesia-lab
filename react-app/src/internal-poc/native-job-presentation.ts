import type { ApiV070NativeJobNativeJob } from './contracts/generated/api-v0.7/types'
import type { ClientLanguage } from '../client-preferences'
import { nativeJobText, type NativeJobTextKey } from './native-job-copy'

type JobPresentation = {
  label: string
  description: string
  status: 'running' | 'done' | 'failed'
  invalidReason?: { code: string; label: string }
}
export type NativeJobState = { state: Exclude<ApiV070NativeJobNativeJob['state'], 'INVALID'> }
  | Pick<Extract<ApiV070NativeJobNativeJob, { state: 'INVALID' }>, 'state' | 'invalidReason'>

const states = {
  QUEUED: { label: 'queuedLabel', description: 'queuedDescription', status: 'running' },
  PREPARING_DATA: { label: 'preparingDataLabel', description: 'preparingDataDescription', status: 'running' },
  VALIDATING: { label: 'validatingLabel', description: 'validatingDescription', status: 'running' },
  REPLAYING: { label: 'replayingLabel', description: 'replayingDescription', status: 'running' },
  VERIFYING: { label: 'verifyingLabel', description: 'verifyingDescription', status: 'running' },
  TERMINAL_READY: { label: 'terminalReadyLabel', description: 'terminalReadyDescription', status: 'running' },
  COMPLETED: { label: 'completedLabel', description: 'completedDescription', status: 'done' },
  FAILED: { label: 'failedLabel', description: 'failedDescription', status: 'failed' },
  INVALID: { label: 'invalidLabel', description: 'invalidDescription', status: 'failed' },
} as const satisfies Record<ApiV070NativeJobNativeJob['state'], { label: NativeJobTextKey; description: NativeJobTextKey; status: JobPresentation['status'] }>

const invalidReasons = {
  DATA_CONTRACT_INVALID: 'dataContractInvalidReason',
  STRATEGY_CONTRACT_INVALID: 'strategyContractInvalidReason',
  ASSUMPTION_CONTRACT_INVALID: 'assumptionContractInvalidReason',
  RUNTIME_RESULT_INVALID: 'runtimeResultInvalidReason',
  VERIFICATION_FAILED: 'verificationFailedReason',
} as const satisfies Record<Extract<ApiV070NativeJobNativeJob, { state: 'INVALID' }>['invalidReason'], NativeJobTextKey>

/** Pure presentation of a stored semantic observation, not a job validator. */
export function describeNativeJobState(job: NativeJobState, language: ClientLanguage = 'ko'): JobPresentation {
  const state = states[job.state]
  return { label: nativeJobText(language, state.label), description: nativeJobText(language, state.description),
    status: state.status, ...(job.state === 'INVALID'
      ? { invalidReason: { code: job.invalidReason, label: nativeJobText(language, invalidReasons[job.invalidReason]) } } : {}) }
}

/** Only the current SDK-validated snapshot, never an inferred phase history.
 * createdAt/updatedAt are not execution duration. Owner checks, job binding,
 * request ordering and result retrieval remain with the existing controller.
 */
export function describeNativeJob(job: ApiV070NativeJobNativeJob, language: ClientLanguage = 'ko'): JobPresentation {
  return describeNativeJobState(job, language)
}
