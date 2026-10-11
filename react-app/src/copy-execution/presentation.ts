import type * as Wire from './fixtures/api-v0.18/types.js'
export type CopyScope = Readonly<{owner: string; sessionId: string; connectionId: string; environment: Wire.Environment}>
export type SourceSelection = Readonly<{sourceSha: string; sourceId: string}>
/** Private trusted producer port. Browser catalogue IDs alone do not supply this binding. */
export type IssuedSourceBinding = Readonly<SourceSelection & {strategyId: string; versionId: string; policyHash: string; environment: Wire.Environment}>
export type CopyPresentation = Readonly<{
  phase: 'unavailable' | 'idle' | 'loading' | 'ready' | 'error' | 'reconciliation'
  reason: string | null; mutationBusy: boolean
  versions: ReadonlyArray<Wire.DeepReadonly<Wire.VersionSummary>>
  copies: ReadonlyArray<Wire.DeepReadonly<Wire.CopySummary>>
  selectedVersion: Wire.DeepReadonly<Wire.ApprovedVersion> | null
  selectedCopy: Wire.DeepReadonly<Wire.CopySnapshot> | null
}>
