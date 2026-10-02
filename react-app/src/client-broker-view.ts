import type { BrokerFilter } from './client-broker-fixtures'
import type { BrokerServicePresentation } from './client-broker-presentation'

/** Presentation memory only. Never account data, a saved server preference or authority. */
export type BrokerReviewView = { category: string; sort: 'rating' | 'recent'; page: number }
export type BrokerViewState = {
  owner: string | null
  datasetIdentity: string
  listFilter: BrokerFilter
  listSort: 'order' | 'rating' | 'reviews' | 'users'
  review: BrokerReviewView
}
export function brokerViewDataset(presentation: BrokerServicePresentation | undefined): string {
  return JSON.stringify([presentation?.catalog == null ? 'metadata' : 'supplied', presentation?.identity ?? null])
}
export function initialBrokerView(owner: string | null, datasetIdentity: string): BrokerViewState {
  return { owner, datasetIdentity, listFilter: 'all', listSort: 'order', review: { category: '전체', sort: 'rating', page: 1 } }
}
export function brokerViewBound(view: BrokerViewState | null | undefined, owner: string | null, datasetIdentity: string): view is BrokerViewState {
  return Boolean(view && view.owner === owner && view.datasetIdentity === datasetIdentity)
}
