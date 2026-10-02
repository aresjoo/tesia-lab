import { useState, type ComponentType, type ReactNode } from 'react'
import { archiveAndResetCopyPreview } from '../client-copy-preview-recovery'
import type { CopyPreviewAccount } from '../use-copy-preview-account'
import { useClientPreferences } from '../client-preferences'
import { copyRecoveryText } from '../client-copy-recovery-copy'

/** Explicit preview-only recovery. Never discard damaged data automatically. */
export function ClientCopyStorageRecovery({ owner, account, Dialog }: {
  owner: string | null
  account: CopyPreviewAccount
  Dialog: ComponentType<{ title: string; children: ReactNode; onClose: () => void }>
}) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const { language } = useClientPreferences()
  const text = (message: string) => copyRecoveryText(language, message)
  const retry = () => {
    const heading = document.getElementById('research-title')
    account.retry()
    setConfirming(false)
    requestAnimationFrame(() => {
      // Successful recovery removes its trigger with the error banner.
      // An unsuccessful read keeps the original focus-return target instead.
      if (heading?.isConnected && !document.querySelector('.copy-storage-error')) heading.focus({ preventScroll: true })
    })
  }
  const recover = () => {
    if (!owner) return
    try {
      const result = archiveAndResetCopyPreview(owner, crypto.randomUUID())
      if (!result.ok) { setError(result.message); return }
      retry()
      setError('')
    } catch {
      setError('복구 요청을 만들지 못했어요. 저장 상태를 다시 확인해주세요.')
    }
  }
  if (!account.storageError) return null
  return <>
    <div className="copy-storage-error" role="alert">
      <span>{text(account.storageError)}</span>
      <button type="button" className="obtn" onClick={retry}>{text('저장 상태 다시 확인')}</button>
      {owner && <button type="button" className="obtn" onClick={() => { setError(''); setConfirming(true) }}>{text('사본 보관 후 새로 시작')}</button>}
    </div>
    {confirming && <Dialog title={text('카피 미리보기를 새로 시작할까요?')} onClose={() => setConfirming(false)}>
      <p>{text('현재 탭에 저장된 기존 기록의 사본을 먼저 보관한 뒤, 카피 목록과 체험용 잔고를 처음 상태로 바꿉니다. 실제 계좌나 자금에는 영향을 주지 않아요.')}</p>
      <p>{text('사본은 이 탭의 임시 저장소에 남으며, 탭을 닫으면 사라질 수 있어요. 사본 저장을 확인하지 못하면 초기화하지 않습니다.')}</p>
      {error && <p role="alert">{text(error)}</p>}
      <div className="ss3-dacts">
        <button type="button" className="obtn" onClick={() => setConfirming(false)}>{text('취소')}</button>
        {error && <button type="button" className="obtn" onClick={retry}>{text('저장 상태 다시 확인')}</button>}
        <button type="button" className="wbtn" onClick={recover}>{text('사본 보관하고 초기화')}</button>
      </div>
    </Dialog>}
  </>
}
