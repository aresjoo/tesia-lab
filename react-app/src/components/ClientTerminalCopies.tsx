import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useClientPreferences } from '../client-preferences'
import { sourceSharedStrategies } from '../client-shared-strategies'
import { calculateCopyPreview } from '../client-copy-preview-state'
import type { CopyPreviewAccount } from '../use-copy-preview-account'
import { copyRecoveryText } from '../client-copy-recovery-copy'
import type { CatalogueCopyView } from '../use-catalogue-copy-account'
import { ClientCatalogueTerminalJudgment } from './ClientCatalogueTerminalJudgment'
import words from '../client-terminal-copies-copy.json'
import '../client-terminal-copies.css'
import { sharingCopy } from '../client-sharing-copy'
import { sharedFollowCopy } from '../client-shared-follow-copy'

/** Source 412fd60 pxTermSide. Legacy preview records retain their original engine. */
export function ClientTerminalCopies({ account, catalogue, judgment, onCatalogueManage, onManage, onFind, onNew, onHistory, onLibrary, onPublishing }: {
  account: CopyPreviewAccount; onManage: (id: string) => void
  catalogue?: CatalogueCopyView; judgment?: ReactNode; onCatalogueManage?: (id: string) => void
  onFind: () => void; onNew: () => void; onHistory: () => void
  onLibrary?: () => void; onPublishing?: () => void
}) {
  const { language } = useClientPreferences(), t = words[language]
  const [sources] = useState(sourceSharedStrategies)
  const title = useRef<HTMLHeadingElement>(null)
  const rows = useMemo(() => account.blocked ? [] : (account.state?.copies ?? []).filter(copy => copy.status === 'active').map(copy => {
    const source = sources.find(item => item.nick === copy.nick) ?? null
    return { copy, name: source?.title || copy.nick, values: calculateCopyPreview(copy, source) }
  }), [account.blocked, account.state, sources])
  const catalogueRows = catalogue?.error ? [] : catalogue?.state?.copies.filter(c => c.record.status === 'active') ?? []
  const count = rows.length + catalogueRows.length
  const money = (value: number, signed = false) => `${value.toLocaleString(language, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: signed ? 'exceptZero' : 'auto' })} USDT`
  if (account.blocked || catalogue?.error) return <section className="client-terminal-copies">
    <h2 ref={title} tabIndex={-1}>{t.manage}</h2>
    <p role="alert">{copyRecoveryText(language, account.blocked ? account.storageError : '카피 미리보기의 저장 결과를 확인하지 못했어요. 다시 불러와 확인해주세요.')}</p>
    <button type="button" className="ctcp-primary" onClick={() => { title.current?.focus(); account.retry(); catalogue?.store.retry() }}>{t.retry}</button>
  </section>
  const showJudgment = Boolean(catalogue && onCatalogueManage && catalogueRows.length)
  return <section className={`client-terminal-copies${showJudgment ? ' has-catalogue-judgment' : ''}`}>
    <h2 ref={title} tabIndex={-1}>{count ? t.active.replace('{count}', count.toLocaleString(language)) : t.empty}</h2>
    {showJudgment && catalogue && onCatalogueManage && (judgment ?? <ClientCatalogueTerminalJudgment key={catalogue.owner} account={catalogue} onManage={onCatalogueManage} onFind={onFind} />)}
    {rows.length ? <ul>{rows.map(({ copy, name, values }) => <li key={`legacy:${copy.id}`}>
      <div><h3>{name}</h3>{values ? <dl><div><dt>{t.capital}</dt><dd>{money(values.inv)}</dd></div><div><dt>{t.net}</dt><dd className={values.net > 0 ? 'is-up' : values.net < 0 ? 'is-down' : undefined}>{money(values.net, true)}</dd></div></dl> : <p>{t.missing}</p>}</div>
      <button type="button" className="ctcp-link" aria-label={`${t.manage}: ${name}`} onClick={() => onManage(copy.id)}>{t.manage}</button>
    </li>)}</ul> : !count && <p>{t.hint}</p>}
    {!showJudgment && <button type="button" className={count ? 'ctcp-link' : 'ctcp-primary'} onClick={onFind}>{count ? t.more : t.find}</button>}
    {!count && <button type="button" className="ctcp-link" onClick={onNew}>{t.new}</button>}
    {(account.state?.copies.some(copy => copy.status === 'closed') || catalogue?.state?.copies.some(copy => copy.record.status === 'closed')) && <button type="button" className="ctcp-link" onClick={onHistory}>{t.history}</button>}
    {count > 0 && !showJudgment && <small>{t.preview}</small>}
    {(onLibrary || onPublishing) && <nav className="ctcp-saved" aria-label={sharedFollowCopy(language, '전략 공유 영역')}>
      {onLibrary && <button type="button" className="ctcp-link" onClick={onLibrary}>{sharingCopy(language, '관심 전략')}</button>}
      {onPublishing && <button type="button" className="ctcp-link" onClick={onPublishing}>{sharingCopy(language, '내 전략')}</button>}
    </nav>}
  </section>
}
