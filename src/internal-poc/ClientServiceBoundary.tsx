import { lazy, Suspense } from 'react'
import type { InternalPocPresentation } from './InternalPocApp'
import { ClientLoadBoundary } from '../components/ClientLoadBoundary'

const ClientServiceExperience = lazy(() => import('./ClientServiceExperience').then(module => ({ default: module.ClientServiceExperience })))

export function ClientServiceBoundary({ state }: { state: InternalPocPresentation }) {
  return <ClientLoadBoundary fallback={<div role="alert"><p>화면을 불러오지 못했습니다. 서버 작업은 취소되지 않습니다.</p><button type="button" onClick={() => location.reload()}>화면 다시 불러오기</button></div>}>
    <Suspense fallback={<p role="status">화면을 준비하고 있습니다.</p>}><ClientServiceExperience state={state} /></Suspense>
  </ClientLoadBoundary>
}
