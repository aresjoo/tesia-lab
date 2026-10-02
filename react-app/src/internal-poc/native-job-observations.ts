import type { NativeJob } from './native-service-api'
import type { ClientLanguage } from '../client-preferences'
import { describeNativeJobState, type NativeJobState } from './native-job-presentation'
import { nativeJobText } from './native-job-copy'

export const MAX_JOB_OBSERVATIONS = 32
export type JobObservation = Readonly<NativeJobState & { updatedAt: string; revision: string }>
export type JobObservations = Readonly<{ scope: string; fingerprint: string; entries: readonly JobObservation[]; truncated: boolean }>

/** View-local observations, not a server event log or phase-completion model.
 * Only accepted props are recorded, in receipt order; no skipped phases, clock
 * durations, persistence, polling, or successful findings are synthesized.
 */
export function observeNativeJob(previous: JobObservations | null, job: NativeJob): JobObservations {
  const scope = JSON.stringify([job.backtestId, job.strategyVersionId, job.semanticHash,
    job.profileId, job.profileContentHash, job.splitGroupId, job.createdAt])
  const reason = job.state === 'INVALID' ? job.invalidReason : ''
  // A new server timestamp/revision in the same contiguous state does not
  // change the observations. The caller still displays the latest job prop.
  const fingerprint = JSON.stringify([job.state, reason])
  if (previous?.scope === scope && previous.fingerprint === fingerprint) return previous
  // Store semantic fields, never translated text. Changing the display language
  // must not append an observation or preserve stale labels in earlier entries.
  const state: NativeJobState = job.state === 'INVALID'
    ? { state: job.state, invalidReason: job.invalidReason } : { state: job.state }
  const entry: JobObservation = { ...state, updatedAt: job.updatedAt, revision: job.revision }
  if (!previous || previous.scope !== scope) return { scope, fingerprint, entries: [entry], truncated: false }
  return { scope, fingerprint, entries: [...previous.entries, entry].slice(-MAX_JOB_OBSERVATIONS),
    truncated: previous.truncated || previous.entries.length === MAX_JOB_OBSERVATIONS }
}

export function describeJobObservations(observations: JobObservations, language: ClientLanguage = 'ko'): string | undefined {
  if (observations.entries.length < 2) return undefined
  return [nativeJobText(language, observations.truncated ? 'recentObservationsHeading' : 'observationsHeading', { count: MAX_JOB_OBSERVATIONS }),
    nativeJobText(language, 'observationsUtcNotice'),
    ...observations.entries.map(entry => {
      const view = describeNativeJobState(entry, language)
      return `${entry.updatedAt.replace('T', ' ').replace('Z', '')} · ${view.label}${view.invalidReason ? ` · ${view.invalidReason.label}` : ''}`
    }),
  ].join('\n')
}
