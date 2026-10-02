import { Fragment, memo } from 'react'
import { ClientResearchActivity, type ResearchActivityProps } from './ClientResearchActivity'
import { ClientResponseMarkdown } from './ClientResponseMarkdown'
import { ClientMarketResponse } from './ClientMarketResponse'
import { marketBindingKey, type MarketResponseBlock } from '../client-market-response-presentation'
import { ClientMarketQuestionCard } from './ClientMarketQuestionCard'
import type { MarketQuestionActions, MarketQuestionBlock } from '../client-market-question-presentation'
import { ClientMarketChartCard } from './ClientMarketChartCard'
import { marketChartLifetime, type MarketChartActions, type MarketChartBlock } from '../client-market-chart-presentation'
import { ClientFollowups } from './ClientFollowups'
import type { FollowupActions, FollowupBlock } from '../client-followup-presentation'

/** Presentation only. The caller owns ordering, stable IDs and observed states.
 * This is not a wire event schema. Never split a final answer into invented
 * tool events, synthesize reasoning, or delay a service completion here.
 */
export type ClientResponseBlock =
  | { id: string; kind: 'work'; activity: Omit<ResearchActivityProps, 'source'> }
  | { id: string; kind: 'text'; text: string; status: 'streaming' | 'done' | 'interrupted' }
  | MarketResponseBlock
  | MarketQuestionBlock
  | MarketChartBlock
  | FollowupBlock

const ResponseText = memo(function ResponseText({ text, status, source }: {
  text: string; status: 'streaming' | 'done' | 'interrupted'; source: 'mock' | 'service'
}) {
  if (!text) return null
  // Formatting is presentation only; raw HTML and action tags stay inert text.
  return <div className="g-amsg" data-source={source} data-response-state={status} aria-busy={status === 'streaming'}>
    <ClientResponseMarkdown text={text} streaming={status === 'streaming'} />
  </div>
})

/** tesia-lab dab5aa2 openOut/sealOut: work → text → work → text,
 * in the same conversation. No timers, fetch, storage or execution authority.
 */
export function ClientResponseSequence({ blocks, source, questionActions, chartActions, followupActions }: {
  blocks: readonly ClientResponseBlock[]; source: 'mock' | 'service'; questionActions?: MarketQuestionActions; chartActions?: MarketChartActions; followupActions?: FollowupActions
}) {
  return <>{blocks.map(block => <Fragment key={block.kind === 'work' || block.kind === 'text' ? block.id : JSON.stringify([block.id, block.kind === 'market-chart' ? marketChartLifetime(block.presentation) : marketBindingKey(block.presentation.binding)])}>
    {block.kind === 'work'
      ? <ClientResearchActivity {...block.activity} source={source} />
      : block.kind === 'text' ? <ResponseText text={block.text} status={block.status} source={source} />
        : block.kind === 'market-question' ? <ClientMarketQuestionCard presentation={block.presentation} actions={questionActions}/>
        : block.kind === 'market-chart' ? <ClientMarketChartCard presentation={block.presentation} actions={chartActions}/>
        : block.kind === 'followups' ? <ClientFollowups presentation={block.presentation} actions={followupActions}/>
        : <ClientMarketResponse block={block} />}
  </Fragment>)}</>
}
