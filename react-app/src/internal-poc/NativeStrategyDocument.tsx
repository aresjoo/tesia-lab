import { useId, type ReactNode } from 'react'
import type { ConversationSnapshot } from './contracts/generated/api-v0.3/types'
import { describeCondition, describeFeature, formatFractionPercent } from './native-strategy-readable'
import { useClientPreferences } from '../client-preferences'
import { nativeShellText } from './native-shell-copy'
import { nativeStrategyText, type NativeStrategyTextKey } from './native-strategy-copy'
import { NativeRowComment, type NativeRowEditor } from './NativeRowComment'
import { nativeRowText } from './native-row-copy'
import { NativeResearchPlan } from './NativeResearchPlan'
import { nativeResearchPlanText } from './native-research-plan-copy'

/** Read-only presentation of the SDK-validated CURRENT draft, not an approval,
 * research finding or result. The complete projection remains available below;
 * summary rows do not reinterpret conditions, units, defaults or risk policy.
 */
export function NativeStrategyDocument({ snapshot, editor, researchPlan = false, planActions = null }: { snapshot: ConversationSnapshot; editor?: NativeRowEditor; researchPlan?: boolean; planActions?: ReactNode }) {
  const id = useId()
  const { language } = useClientPreferences()
  const t = (key: NativeStrategyTextKey) => nativeStrategyText(language, key)
  const observed = (value: string | number | null | undefined) =>
    value === null || value === undefined || value === '' ? t('unknown') : `${value}`
  // Compile-time pins for the fixed copy below, not a local schema/validator.
  // A generated contract widening must require an explicit presentation review.
  const projection = snapshot.draftState.projection satisfies {
    clock?: { evaluateOn: 'candle_close'; oncePerCandle: true }
    entryRules: readonly { side: 'long'; rearm: 'on_false'; positionExistsPolicy: 'skip' }[]
    exitRules: readonly { triggerPrice: 'mark_price'; orderType: 'market'; reduceOnly: true }[]
    positionSizing?: { type: 'fixed_notional' }
    execution?: { entryOrderType: 'market' }
  }
  const rows: readonly (readonly [NativeStrategyTextKey, ReactNode])[] = [
    ['symbol', observed(projection.market?.symbol)],
    ['exchange', observed(projection.market?.exchange)],
    ['timeframe', observed(projection.clock?.timeframe)],
    ['amount', projection.positionSizing
      ? `${projection.positionSizing.amount} ${projection.positionSizing.currency}` : t('unknown')],
    ['leverage', projection.execution ? nativeStrategyText(language, 'leverageValue', { value: projection.execution.leverage }) : t('unknown')],
    ['marketType', observed(projection.market?.marketType)],
    ['timezone', observed(projection.clock?.timezone)],
  ]
  const exitValue = (kind: 'stop_loss' | 'take_profit') => projection.exitRules.filter(rule => rule.kind === kind)
    .map(rule => `${formatFractionPercent(rule.distanceFraction, language)} · ${t('exitExecution')}`).join('\n')
  const planValues = {
    target: [projection.market?.symbol, projection.market?.exchange, projection.clock?.timeframe, projection.market?.marketType].filter(Boolean).join(' · '),
    entry: projection.entryRules.map(rule => {
      const description = describeCondition(rule.condition, projection.features, language)
      return [description.text, ...description.warnings].join('\n')
    }).join('\n'),
    stopLoss: exitValue('stop_loss'),
    takeProfit: exitValue('take_profit'),
  }
  // A missing condition no longer mounts its plan editor. Keep its unsent or
  // uncertain comment discoverable in the existing previous-items section.
  const currentRows = new Set<string>([...rows.map(([key]) => key), ...projection.entryRules.map(rule => `entry:${rule.id}`), ...projection.exitRules.map(rule => `exit:${rule.id}`), ...(researchPlan ? Object.entries(planValues).filter(([, value]) => value).map(([key]) => `plan:${key}`) : [])])
  const previousRows = Object.entries(editor?.rows ?? {}).filter(([key, row]) => !currentRows.has(key) && (row.text || row.status))
  const detail = <article className="native-strategy-document" aria-label={t('article')} data-draft-id={snapshot.draftId} data-draft-revision={snapshot.draftRevision}>
    <h2>{nativeShellText(language, 'strategyDraft')}</h2>
    <p>{t('draftNotice')}</p>
    <p>{t('workflowNotice')}</p>
    {projection.metadata?.title && <h3>{projection.metadata.title}</h3>}
    {projection.metadata?.description && <p className="native-strategy-description">{projection.metadata.description}</p>}
    <dl>{rows.map(([key, value]) => <div key={key}><dt>{t(key)}</dt><dd className={editor ? 'native-row-editable' : undefined}><span>{value}</span>{editor && <NativeRowComment rowKey={key} label={t(key)} editor={editor} />}</dd></div>)}</dl>
    <section className="native-strategy-rules" aria-labelledby={`${id}-features`}>
      <h3 id={`${id}-features`}>{t('features')}</h3>
      {projection.features.length === 0 ? <p className="native-rule-note">{t('noFeatures')}</p> : <ul className="native-feature-list">
        {projection.features.map((feature, index) => <li key={index}>
          <span>{describeFeature(feature, language)}</span><code className="native-rule-id">{feature.id}</code>
        </li>)}
      </ul>}
    </section>
    <section className="native-strategy-rules" aria-labelledby={`${id}-entries`}>
      <h3 id={`${id}-entries`}>{t('entries')}</h3>
      {projection.entryRules.length === 0 ? <p className="native-rule-note">{t('noEntries')}</p> : <>
        <p className="native-rule-note">{t(projection.clock ? 'clockSet' : 'clockUnset')}</p>
        <ol className="native-rule-list">
          {projection.entryRules.map((rule, index) => {
            const description = describeCondition(rule.condition, projection.features, language)
            return <li key={rule.id}>
              <div className="native-row-heading"><h4>{t('longEntry')} <span className="native-rule-number">{index + 1}</span></h4>
                {editor && <NativeRowComment rowKey={`entry:${rule.id}`} label={`${t('longEntry')} ${index + 1} (${rule.id})`} editor={editor} />}</div>
              <p className="native-rule-condition">{description.text}</p>
              {description.warnings.length > 0 && <p className="native-rule-warning">{description.warnings.join('\n')}</p>}
              <p className="native-rule-note">{t('positionRule')}</p>
              <details className="native-rule-reference"><summary>{t('ruleInfo')}</summary>
                <dl><div><dt>{t('ruleId')}</dt><dd><code>{rule.id}</code></dd></div>
                  <div><dt>{t('entryOrder')}</dt><dd>{t(projection.execution ? 'marketOrder' : 'unknown')}</dd></div></dl>
              </details>
            </li>
          })}
        </ol>
      </>}
    </section>
    <section className="native-strategy-rules" aria-labelledby={`${id}-exits`}>
      <h3 id={`${id}-exits`}>{t('exits')}</h3>
      {projection.exitRules.length === 0 ? <p className="native-rule-note">{t('noExits')}</p> : <>
        <p className="native-rule-note">{t('distanceNotice')}</p>
        <ul className="native-rule-list">
          {projection.exitRules.map(rule => <li key={rule.id}>
            <div className="native-row-heading"><h4>{t(rule.kind === 'stop_loss' ? 'stopLoss' : 'takeProfit')} <span className="native-rule-value">{formatFractionPercent(rule.distanceFraction, language)}</span></h4>
              {editor && <NativeRowComment rowKey={`exit:${rule.id}`} label={`${t(rule.kind === 'stop_loss' ? 'stopLoss' : 'takeProfit')} (${rule.id})`} editor={editor} />}</div>
            <p className="native-rule-note">{t('exitExecution')}</p>
            <details className="native-rule-reference"><summary>{t('ruleInfo')}</summary>
              <dl><div><dt>{t('ruleId')}</dt><dd><code>{rule.id}</code></dd></div>
                <div><dt>{t('rawDistance')}</dt><dd><code>{rule.distanceFraction}</code></dd></div>
                <div><dt>{t('priority')}</dt><dd>{rule.priority}</dd></div></dl>
            </details>
          </li>)}
        </ul>
      </>}
    </section>
    {previousRows.length > 0 && <section className="native-row-previous" aria-labelledby={`${id}-previous-rows`}>
      <h3 id={`${id}-previous-rows`}>{nativeRowText(language, 'previous')}</h3>
      {previousRows.map(([key, row]) => <div key={key}>
        <p>{row.label ?? key}</p><p className="native-strategy-description">{row.text || row.submittedText}</p>
        {row.status && <p role="status">{nativeRowText(language, row.status)}{row.detail && <span> {row.detail}</span>}</p>}
      </div>)}
    </section>}
    {snapshot.unresolvedCapabilityBlockers.length > 0 && <section aria-labelledby={`${id}-blockers`}>
      <h3 id={`${id}-blockers`}>{t('blockers')}</h3>
      <ul>{snapshot.unresolvedCapabilityBlockers.map(blocker => <li key={blocker.blockerId}><code>{blocker.reasonCode}</code></li>)}</ul>
    </section>}
    <details className="native-strategy-source">
      <summary>{t('source')}</summary>
      <pre aria-label={t('sourceLabel')} tabIndex={0}>{JSON.stringify(projection, null, 2)}</pre>
    </details>
    <details className="native-strategy-binding">
      <summary>{t('binding')}</summary>
      <dl>{([
        ['conversationId', t('conversationId'), snapshot.conversationId], ['draftId', t('draftId'), snapshot.draftId],
        ['conversationRevision', t('conversationRevision'), snapshot.conversationStateRevision], ['draftRevision', t('draftRevision'), snapshot.draftRevision],
        ['conversationHash', t('conversationHash'), snapshot.conversationStateHash],
        // Existing technical labels deliberately stay identical in every locale.
        ['projectionHash', 'Projection hash', snapshot.projectionHash], ['semanticHash', 'Semantic hash', observed(snapshot.semanticHash)],
      ] as const).map(([key, label, value]) => <div key={key}><dt>{label}</dt><dd><code>{value}</code></dd></div>)}</dl>
    </details>
  </article>
  if (!researchPlan) return detail
  const planRow = (key: 'target' | 'entry' | 'stopLoss' | 'takeProfit', value: string | undefined) => value ? {
    value,
    editor: editor ? <NativeRowComment rowKey={`plan:${key}`} label={nativeResearchPlanText(language, key)} editor={editor} /> : undefined,
  } : undefined
  return <NativeResearchPlan scopeId={`${snapshot.conversationId}:${snapshot.draftId}`}
    summary={projection.metadata?.description}
    target={planRow('target', planValues.target)}
    entry={planRow('entry', planValues.entry)}
    stopLoss={planRow('stopLoss', planValues.stopLoss)} takeProfit={planRow('takeProfit', planValues.takeProfit)}
    actions={planActions}
    rawDetails={<details className="native-plan-technical"><summary>{t('source')}</summary>{detail}</details>} />
}
