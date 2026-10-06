import { readInvestmentDisplay, validInvestmentDisplay } from './investment-display-contract.mjs';
import { settingsPreviewTag } from './investment-intent-admission.mjs';
/** Streaming protocol guard. It is not a semantic financial fact checker. */
const BLOCKED = ['[ORDER', '[ACT', '[TLINE', '[SETUP', '[STRATEGY', '[GAUGE', '<WORK', '<CHIPS', '<THINK'];
const DISPLAY = ['[CHART', '[ASK', '[NEXT', '[TITLE'];
const MAX_OUTPUT_CHARS = 64000;

export function createInvestmentOutputGate(write, { settingsPreview = null, allowDisplay = true, allowTitle = true, allowQuestions = true } = {}) {
  const previewTag = settingsPreviewTag(settingsPreview);
  const seen = new Set();
  let tail = '', emitted = false, failed = false, ended = false, total = 0;
  function fail() {
    if (ended) return;
    failed = true; tail = ''; ended = true;
    return write({ error: true });
  }
  function text(value) {
    total += value.length;
    if (total > MAX_OUTPUT_CHARS) return fail();
    let pending = tail + value;
    if (/\[(?:ORDER|SETUP|STRATEGY|GAUGE)\s*\{|\[(?:ACT|TLINE)\s*\[|<(?:WORK|CHIPS|THINK)(?=[\s/>])/i.test(pending)) return fail();
    tail = '';
    for (;;) {
      const tag = readInvestmentDisplay(pending);
      if (!tag) break;
      // Never emit any part of an incomplete structured tag.
      if (tag.start) { emitted = true; write({ text: pending.slice(0, tag.start) }); pending = pending.slice(tag.start); continue; }
      if (tag.invalid || pending.length > 4096 && tag.incomplete) return fail();
      if (tag.incomplete) { tail = pending; return; }
      if (!allowDisplay || previewTag || seen.has(tag.name) || (tag.name === 'ASK' && seen.has('NEXT')) || (tag.name === 'NEXT' && seen.has('ASK')) || !validInvestmentDisplay(tag.name, tag.value, { allowTitle })) return fail();
      seen.add(tag.name);
      if(allowQuestions || !['ASK','NEXT'].includes(tag.name)){ emitted = true; write({ text: pending.slice(0, tag.end) }); }
      pending = pending.slice(tag.end);
    }
    // ASCII normalization keeps offsets stable for ß/ligatures/combining text.
    const upper = pending.replace(/[a-z]/g, (character) => character.toUpperCase());
    if (/\[(?:ORDER|SETUP|STRATEGY|GAUGE)\s*\{|\[(?:ACT|TLINE)\s*\[|<(?:WORK|CHIPS|THINK)(?=[\s/>])/i.test(pending)) return fail();
    let keep = 0;
    for (const marker of [...BLOCKED, ...DISPLAY]) {
      for (let n = 1; n <= marker.length && n <= upper.length; n++) {
        if (marker.startsWith(upper.slice(-n))) keep = Math.max(keep, n);
      }
      // Hold the word and whitespace until JSON/tag syntax distinguishes a tag
      // from ordinary citations such as [Strategy research](...).
      const at = upper.lastIndexOf(marker);
      if (at >= 0 && /^\s*$/.test(upper.slice(at + marker.length))) keep = Math.max(keep, pending.length - at);
    }
    if (keep > 256) return fail();
    const ready = pending.slice(0, pending.length - keep);
    tail = keep ? pending.slice(-keep) : '';
    if (ready) { emitted = true; return write({ text: ready }); }
  }
  return Object.freeze({
    get failed() { return failed; },
    send(event) {
      if (ended) return;
      if (!event || typeof event !== 'object') return fail();
      if (event.error) return fail();
      // Raw internal thinking is never forwarded. No substitute narration is made.
      if (event.think !== undefined) return;
      if (event.text !== undefined) {
        if (typeof event.text !== 'string') return fail();
        return text(event.text);
      }
      if (event.done) {
        // A partial control prefix, empty answer or prior error cannot be success.
        if (tail === '[' || tail === '<') { emitted = true; write({ text: tail }); tail = ''; }
        if (tail || !emitted || failed) return fail();
        if (previewTag) write({ text: previewTag });
        ended = true;
      }
      // Only server-observed progress fields are admitted; arbitrary metadata is not UI authority.
      const allowed = ['tool', 'sres', 'fres', 'tres', 'mres', 'tok', 'usage', 'done'];
      const clean = Object.fromEntries(allowed.filter((key) => Object.hasOwn(event, key)).map((key) => [key, event[key]]));
      if (Object.keys(clean).length) return write(clean);
    },
  });
}
