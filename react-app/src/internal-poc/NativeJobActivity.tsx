import { useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { nativeJobText, type NativeJobTextKey } from './native-job-copy'
import { ClientResearchActivity } from '../components/ClientResearchActivity'
import type { NativeJob } from './native-service-api'
import { describeNativeJob } from './native-job-presentation'
import { describeJobObservations, observeNativeJob, MAX_JOB_OBSERVATIONS } from './native-job-observations'

// Current SDK-accepted state plus view-local observations. A creation time is
// not an execution start, and missing intermediate phases are never inferred.
export function NativeJobActivity({ job }: { job: NativeJob }) {
  const { language } = useClientPreferences()
  const text = (key: NativeJobTextKey) => nativeJobText(language, key, { count: MAX_JOB_OBSERVATIONS })
  const [observations, setObservations] = useState(() => observeNativeJob(null, job))
  const current = observeNativeJob(observations, job)
  if (current !== observations) setObservations(current)
  const view = describeNativeJob(job, language)
  return <div className="native-job-activity" data-native-job-state={job.state}>
    <ClientResearchActivity key={job.backtestId} source="service" label={view.label} status={view.status}
      steps={[{ id: `${job.backtestId}:current`, title: text('currentServerStateTitle'), status: view.status,
        detail: `${view.description}${current.truncated ? ` ${text('truncatedObservationsNotice')}` : ''}`,
        publicSummary: describeJobObservations(current, language) }]} />
    {view.invalidReason && <p className="native-job-problem">
      <strong>{view.invalidReason.label}</strong><code>{view.invalidReason.code}</code>
    </p>}
    {job.state === 'FAILED' && <p className="native-job-problem">{text('noFailureReasonNotice')}</p>}
    <p className="native-job-updated">{text('lastServerUpdateLabel')} <time dateTime={job.updatedAt}>{job.updatedAt.replace('T', ' ').replace('Z', ' UTC')}</time></p>
    <details className="native-job-metadata">
      <summary>{text('jobMetadataSummary')}</summary>
      <dl>{([
        ['stateCodeLabel', job.state], ['jobIdLabel', job.backtestId], ['strategyVersionLabel', job.strategyVersionId],
        ['serverRevisionLabel', job.revision], ['jobCreatedAtLabel', job.createdAt],
        ['profileLabel', job.profileId], ['resultLookupLabel', text(job.resultAvailable ? 'resultLookupAvailable' : 'resultLookupNotYetAvailable')],
      ] as const).map(([key, value]) => <div key={key}><dt>{text(key)}</dt><dd>{value}</dd></div>)}</dl>
      <p>{text('jobMetadataNotice')}</p>
    </details>
  </div>
}
