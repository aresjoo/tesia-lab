import { catalogueAssets, catalogueSourceSha, findCatalogueStrategy } from './client-catalogue'
import type { CataloguePreviewResult } from './client-catalogue-preview'
import { catalogueDateReader } from './client-catalogue-presentation'
/** Frozen source 21316–21318 / 21691–21692. cfg is canonical; p is null
 * for all catalogue seeds. This does not create a Strategy Version. */
export function readCatalogueDetailHeader(value: CataloguePreviewResult) {
  const strategy = findCatalogueStrategy(value.strategy.id)
  if (value.source !== 'client-snapshot-preview' || value.sourceSha !== catalogueSourceSha || !strategy
    || JSON.stringify(strategy) !== JSON.stringify(value.strategy)) return null
  const stop = !('sl' in strategy) || strategy.sl == null ? 5 : Math.abs(strategy.sl)
  const minimum = strategy.kind === 'agent' ? strategy.top >= 3 ? 500 : strategy.top === 2 ? 300 : 200 : stop >= 8 ? 500 : stop >= 5 ? 200 : 100
  const index = value.result.eq[0]?.i
  const since = index == null ? null : catalogueDateReader(value.calendar)(index)
  if (since && !Number.isFinite(since.getTime())) return null
  return { strategy, minimum, since, assets: catalogueAssets(strategy), hasConfiguration: true, hasImportableSettings: false }
}
/** A display-only handoff. The caller must retain the source-bound Mock path;
 * this text supplies neither model authority nor real backtest approval. */
export function catalogueVerificationRequest(value: CataloguePreviewResult): string | null {
  const header = readCatalogueDetailHeader(value)
  if (!header) return null
  return `클라이언트 원본 전략 직접 검증 요청: ${header.strategy.name}. 원본 전략 ID: ${header.strategy.id}. 원본: ${value.sourceSha}. 자료: ${value.calendar.start} ~ ${value.calendar.asof}, ${value.dataVersion.spot}, ${value.dataVersion.futures}. 설정값: ${JSON.stringify(header.strategy)}. 저장된 원본 가격 자료를 사용하는 Mock 미리보기로 이 설정을 확인해 주세요. 다른 조건이나 자산을 만들지 말고 실제 주문·승인·실서비스 검증 완료로 표시하지 마세요.`
}
