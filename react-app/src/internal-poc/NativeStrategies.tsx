import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useClientPreferences } from '../client-preferences'
import { researchCopy } from '../client-research-copy'
import strategyListCopy from '../client-strategy-list-copy.json'
import { ClientStrategySharing } from '../components/ClientStrategySharing'
import { unavailableSharingPresentation, type SharingServicePresentation } from '../client-sharing-presentation'
import type { BrokerServicePresentation } from '../client-broker-presentation'
import type { SharedLocation } from '../client-shared-strategies'
import type { SharingPreferences, SharingPreferenceSnapshot } from '../client-sharing-preferences'
import '../client-research-hub.css'
import { NativePublicStrategyCatalogue } from './NativePublicStrategyCatalogue'

/** Memory-only source UI choices, not account or execution authority. */
export type NativeStrategyViewState = {
  owner: string | null
  datasetIdentity: string
  preferences: SharingPreferences
  query: string
}

type NativeStrategiesProps = {
  onReturn: () => void; shouldFocus: () => boolean; executionContent?: ReactNode; onTabChange: () => void; notice?: ReactNode
  brokerPresentation?: BrokerServicePresentation
  presentation?: SharingServicePresentation; owner?: string | null; signedIn?: boolean; onLogin?: () => void
  onAsk?: (text: string) => void | Promise<void>
  location?: SharedLocation
  onNavigate?: (location: SharedLocation, replace?: boolean) => void
  /** Stable display dataset identity; row refreshes must not change this value. */
  datasetIdentity?: string
  viewState?: NativeStrategyViewState | null
  onViewStateChange?: (next: NativeStrategyViewState) => void
}
/** Owner/dataset replacement and data removal discard local routes and drafts. */
export function NativeStrategies(props: NativeStrategiesProps) {
  if (!props.presentation) return <NativePublicStrategyCatalogue key={props.owner ?? 'public'} onReturn={props.onReturn}
    location={props.location} onNavigate={props.onNavigate} shouldFocus={props.shouldFocus} signedIn={props.signedIn ?? false} onLogin={props.onLogin ?? props.onReturn} />
  return <NativeStrategySurface key={JSON.stringify([props.owner ?? null, props.datasetIdentity ?? 'default', props.presentation !== undefined])} {...props} />
}
/** Same source sharing renderer, with explicit service-only inputs. */
function NativeStrategySurface({ onReturn, shouldFocus, executionContent, onTabChange, notice, presentation, brokerPresentation, owner = null, signedIn = true, onLogin = onReturn, onAsk, location: suppliedLocation, onNavigate, datasetIdentity = 'default', viewState, onViewStateChange }: NativeStrategiesProps) {
  const { language } = useClientPreferences()
  const empty = {
    ko: ['공개 전략 목록이 아직 연결되어 있지 않습니다.', '따라가는 전략 목록이 아직 연결되어 있지 않습니다.'],
    en: ['The public strategy catalog is not connected yet.', 'Your followed strategy list is not connected yet.'],
    ja: ['公開戦略の一覧はまだ接続されていません。', 'フォロー中の戦略一覧はまだ接続されていません。'],
    'zh-CN': ['公开策略列表尚未接入。', '跟随策略列表尚未接入。'],
    'zh-TW': ['公開策略清單尚未接上。', '跟隨策略清單尚未接上。'],
    es: ['El catálogo de estrategias públicas aún no está conectado.', 'La lista de estrategias que sigues aún no está conectada.'],
    fr: ['Le catalogue de stratégies publiques n’est pas encore connecté.', 'La liste des stratégies suivies n’est pas encore connectée.'],
  }[language]
  const supplied = !presentation || presentation === unavailableSharingPresentation ? { ...unavailableSharingPresentation, message: empty[0], follows: { state: 'unavailable' as const, rows: [], message: empty[1] } } : presentation
  const [localView, setLocalView] = useState<NativeStrategyViewState>(() => ({ owner, datasetIdentity, preferences: { tab: 'find', sort: 'pick', dir: 'desc', asset: 'all' }, query: '' }))
  // A missing producer must not disable local tab exploration. The shell owns
  // cross-route persistence only when an explicit presentation is supplied.
  const controlled = presentation !== undefined && onViewStateChange !== undefined
  const view = controlled && viewState?.owner === owner && viewState.datasetIdentity === datasetIdentity ? viewState : localView
  const latestView = useRef(view)
  useLayoutEffect(() => { latestView.current = view }, [view])
  const changeView = (update: (current: NativeStrategyViewState) => NativeStrategyViewState) => {
    // The source Reset action changes query and asset in one event. Merge each
    // patch against the preceding patch, not the render's stale snapshot.
    const next = update(latestView.current)
    latestView.current = next
    if (controlled) onViewStateChange(next)
    else setLocalView(next)
  }
  const snapshot: SharingPreferenceSnapshot = { preferences: view.preferences, query: view.query, storageError: false }
  const [localLocation, setLocation] = useState<SharedLocation>({ period: 'all' })
  const location = suppliedLocation ?? localLocation
  const title = useRef<HTMLHeadingElement>(null), id = useId()
  useLayoutEffect(() => { if (shouldFocus()) title.current?.focus({ preventScroll: true }) }, [shouldFocus])
  return <section id="research-main" className="client-research-hub client-sharing-hub native-strategies" aria-labelledby={id}>
    <header className="hub-header"><h1 id={id} ref={title} tabIndex={-1}>{strategyListCopy[language].title}</h1><button type="button" onClick={onReturn}>{researchCopy(language, 'return')}</button></header>
    <ClientStrategySharing key={owner} location={location} onNavigate={onNavigate ?? setLocation} onAsk={onAsk ?? (() => Promise.reject(new Error('UNAVAILABLE')))} onReturn={onReturn} signedIn={signedIn} onLogin={onLogin} owner={owner}
      viewPreferences={{ state: snapshot, onChange: patch => changeView(current => ({ ...current, preferences: { ...current.preferences, ...patch } })), onQuery: query => changeView(current => ({ ...current, query })) }}
      brokerPresentation={brokerPresentation} servicePresentation={supplied} shouldFocus={shouldFocus} routeTitleRef={title} onTabChange={onTabChange} noticeContent={notice} mine={executionContent} />
  </section>
}
