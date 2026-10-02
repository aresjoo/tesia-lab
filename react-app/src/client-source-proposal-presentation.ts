import type { ClientLanguage } from './client-preferences'
import type { SourceDiscussionDisplay, SourceProposalRow, SourceProposalNote } from './client-terminal-source-proposal'
import { sourceProposalText } from './client-source-proposal-copy'
import { sharedNumber, sharedPercent } from './client-shared-number-format'
import { projectSourceQuestion } from './client-source-question-view'

export type SourceDiscussionPresentation =
  | { kind: 'proposal'; rows: { label: string; current: string; proposed: string; delta: string }[]; notes: string[]; unsupported: string[] }
  | { kind: 'answer'; title: string; text: string }

/** Pure display projection. No parser, evaluator, seed lookup, clock or mutation. */
export function projectSourceDiscussion(display: SourceDiscussionDisplay, language: ClientLanguage): SourceDiscussionPresentation {
  if (display.kind === 'question') return projectSourceQuestion(display.view, language)
  const t = (key: Parameters<typeof sourceProposalText>[1], values?: Readonly<Record<string, string>>) => sourceProposalText(language, key, values)
  const number = (value: number) => sharedNumber(value, language, 'auto')
  const noteText = (note: SourceProposalNote) => note.kind === 'riskTrend' ? t(note.kind) : note.kind === 'stopTight' ? t(note.kind, { value: number(note.value) }) : t(note.kind, { from: number(note.from), to: number(note.to) })
  const delta = (current: number, proposed: number, suffix = '') => `${proposed > current ? '▲' : '▼'} ${number(proposed - current)}${suffix}`
  const row = (item: SourceProposalRow) => {
    if (item.field === 'trendFilter') return { label: t('rowTrend'), current: t(item.current ? 'enabled' : 'disabled'), proposed: t(item.proposed ? 'enabled' : 'disabled'), delta: t(item.proposed ? 'added' : 'removed') }
    if (item.field === 'tp') return { label: t('rowTarget'), current: item.current === null ? t('none') : `+${number(item.current)}%`, proposed: `+${number(item.proposed)}%`, delta: item.current === null ? t('new') : delta(item.current, item.proposed, '%p') }
    const suffix = item.field === 'sl' ? '%' : ''
    return { label: t(item.field === 'sl' ? 'rowStop' : 'rowRsi'), current: `${number(item.current)}${suffix}`, proposed: `${number(item.proposed)}${suffix}`, delta: delta(item.current, item.proposed, item.field === 'sl' ? '%p' : '') }
  }
  if (display.kind === 'proposal') return {
    kind: 'proposal', rows: display.rows.map(row), unsupported: display.unsupported.map(key => t(key)),
    notes: display.notes.map(noteText),
  }
  if (display.kind === 'snappedUnchanged') return { kind: 'answer', title: t('snappedUnchangedTitle'), text: [...display.notes.map(noteText), t('snappedUnchangedText')].join('\n') }
  if (display.kind === 'stop') return { kind: 'answer', title: t('stopTitle'), text: t('stopText', { stop: number(display.stop), mdd: sharedNumber(display.mdd, language), count: number(display.count) }) }
  if (display.kind === 'recent') return { kind: 'answer', title: t('recentTitle'), text: t('recentText', {
    last: display.last ?? t('noRecord'), rsi: number(display.rsi), stop: number(display.stop),
    target: display.target === null ? '' : t('targetClause', { target: number(display.target) }),
    ret: sharedPercent(display.ret, language), mdd: sharedNumber(display.mdd, language), winRate: number(display.winRate),
  }) }
  if (display.kind === 'unsupported') return { kind: 'answer', title: t('unsupportedTitle'), text: [...(display.notes ?? []).map(noteText), t('supportText') + (display.fields.length ? ` ${t('unsupportedText', { items: display.fields.map(key => t(key)).join(', ') }).trimStart()}` : '')].join('\n') }
  return { kind: 'answer', title: t(`${display.kind}Title`), text: t(`${display.kind}Text`) }
}
