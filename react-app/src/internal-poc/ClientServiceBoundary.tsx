import { lazy, Suspense } from 'react'
import type { InternalPocPresentation } from './InternalPocApp'
import { ClientLoadBoundary } from '../components/ClientLoadBoundary'
import { useClientPreferences } from '../client-preferences'
import { nativeExecutionUiText } from './native-execution-ui-copy'

const ClientServiceExperience = lazy(() => import('./ClientServiceExperience').then(module => ({ default: module.ClientServiceExperience })))

export function ClientServiceBoundary({ state }: { state: InternalPocPresentation }) {
  const { language } = useClientPreferences()
  const ui = (text: string) => nativeExecutionUiText(language, text)
  return <ClientLoadBoundary fallback={<div role="alert"><p>{ui('화면을 불러오지 못했습니다. 서버 작업은 취소되지 않습니다.')}</p><button type="button" onClick={() => location.reload()}>{ui('화면 다시 불러오기')}</button></div>}>
    <Suspense fallback={<p role="status">{ui('화면을 준비하고 있습니다.')}</p>}><ClientServiceExperience state={state} /></Suspense>
  </ClientLoadBoundary>
}
