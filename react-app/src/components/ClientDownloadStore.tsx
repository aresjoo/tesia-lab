import { useMemo, type CSSProperties, type ReactNode } from 'react'
import qrcode from 'qrcode-generator'
import { useClientPreferences } from '../client-preferences'
import { validateStoreUrl, type DownloadStore } from '../client-download-config'
import publicCopy from '../client-public-copy.json'
import { downloadText } from '../client-download-copy'

const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const

export function ClientDownloadStore({ store, url, icon }: { store: DownloadStore; url: string | null; icon: ReactNode }) {
  const { language } = useClientPreferences()
  const index = Math.max(0, languages.indexOf(language))
  const safeUrl = validateStoreUrl(store, url)
  const image = useMemo(() => {
    if (!safeUrl) return null
    try {
      const qr = qrcode(0, 'M')
      // Validated URLs are ASCII, without lossy implicit Unicode encoding.
      qr.addData(safeUrl, 'Byte')
      qr.make()
      // Four-module quiet zone, local only. No remote QR service or HTML injection.
      return { src: qr.createDataURL(4, 16), size: Math.max(104, (qr.getModuleCount() + 8) * 2) }
    } catch { return null }
  }, [safeUrl])
  const platform = store === 'ios' ? 'App Store' : 'Google Play'
  const ready = safeUrl !== null && image !== null
  // Keep the source's compact layout for usual URLs; dense codes need at least
  // two CSS pixels per module. Wrapping beats an attractive but unreadable QR.
  const qrSize = ready ? image.size + 12 : 96
  return <div className={`store${qrSize > 144 ? ' store-dense' : ''}`} id={`store-${store}`} style={{ '--download-qr-size': `${qrSize}px` } as CSSProperties}>
    {icon}<div className="store-copy"><b>{platform}</b>{ready ? <><span className="pc">{downloadText(language, 'scan')}</span><span className="mo">{downloadText(language, 'install')}</span></> : <span>{downloadText(language, 'pending')}</span>}</div>
    {ready ? <>
      <div className="qr" data-store={store}><img src={image.src} alt={`${platform} QR`} /></div>
      <a className="link" href={safeUrl} target="_blank" rel="noopener noreferrer">{publicCopy.download.linkOpen[index]}</a>
    </> : <div className="qr todo" data-store={store}>{downloadText(language, 'pendingQr')}</div>}
  </div>
}
