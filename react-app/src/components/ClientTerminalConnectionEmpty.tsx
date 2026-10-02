import '../client-terminal-connection-empty.css'
import { useClientPreferences } from '../client-preferences'
import { clientTerminalText } from '../client-terminal-copy'

/** Source connection prompt only; the caller owns connection state and navigation. */
export function ClientTerminalConnectionEmpty({ onConnect }: { onConnect?: () => void }) {
  const { language } = useClientPreferences()
  return <div className="client-terminal-connection-empty tft-empty tft-connempty">
    <b>{clientTerminalText(language, 'connectionTitle')}</b>
    <span>{clientTerminalText(language, 'connectionBody')}</span>
    <button type="button" className="nfx-btn pri" aria-disabled={!onConnect} onClick={() => { if (onConnect) onConnect() }}>{clientTerminalText(language, 'connectExchange')}</button>
  </div>
}
