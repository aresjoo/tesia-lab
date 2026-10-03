/** Narrow source-Mock settings navigation. Not a DraftPatch or execution grant. */
// Only a complete, deliberately closed user request enters the legacy settings
// wizard. Rich strategy conditions stay intact for the typed proposal path.
const SIMPLE_START = /^(?:(?:비트코인|BTC(?:\/?USDT)?|이더리움|ETH(?:\/?USDT)?)\s*(?:으로|의|로)?\s*(?:자동\s*매매\s*)?전략\s*(?:을\s*)?(?:만들어\s*(?:줘|주세요)|생성해\s*(?:줘|주세요)|만들고\s*싶(?:어|어요|습니다)))[.!?\s]*$/i;

export function admitSettingsPreview(messages, { historyTruncated = false } = {}) {
  if (historyTruncated || messages?.[0]?.role !== 'user') return null;
  const current = messages?.at(-1);
  if (current?.role !== 'user' || typeof current.content !== 'string') return null;
  const text = current.content.normalize('NFC').trim();
  if (!SIMPLE_START.test(text)) return null;
  const pair = /^(?:비트코인|BTC)/i.test(text) ? 'BTC/USDT' : 'ETH/USDT';
  // A legacy wizard cannot carry richer prior user conditions. Do not drop them.
  // Admit only an initial request or exact same-asset simple repeats.
  for (const previous of messages.slice(0, -1).filter((message) => message.role === 'user')) {
    const earlier = previous.content.normalize('NFC').trim();
    if (!SIMPLE_START.test(earlier) || (/^(?:비트코인|BTC)/i.test(earlier) ? 'BTC/USDT' : 'ETH/USDT') !== pair) return null;
  }
  return Object.freeze({ entryMode: null, pair });
}

export function settingsPreviewTag(preview) {
  if (!preview) return '';
  if (preview.entryMode !== null || !['BTC/USDT', 'ETH/USDT'].includes(preview.pair) || Object.keys(preview).length !== 2) throw new Error('SETTINGS_PREVIEW_REJECTED');
  return '\n[SETUP ' + JSON.stringify({ entryMode: null, pair: preview.pair }) + ']';
}
