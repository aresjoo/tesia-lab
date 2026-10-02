import type { CatalogueStrategy } from './client-catalogue'
import type { CataloguePreviewResult } from './client-catalogue-preview'
export type SourceJudgment = {
  i: number; k: 'now' | 'intro' | 'buy' | 'sell' | 'pick' | 'hold' | 'wait'
  tag: string; t: string; title: string; a?: string; cnt?: number; from?: number
}
export const judgmentSourceSha: string
export function createJudgmentRuntime(context: {
  prices: (asset: string) => readonly number[]; date: (index: number) => Date; length: number
  universes: Record<string, { label: string; list: readonly string[] }>; symbol: (text: string) => string
}): {
  messages(strategy: CatalogueStrategy & { cfg: CatalogueStrategy; r: CataloguePreviewResult['result'] }, result: CataloguePreviewResult['result']): SourceJudgment[]
  glossary: Record<string, string>; icons: Record<string, string>
}
