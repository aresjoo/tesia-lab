/* TETH 답변 스트림의 구조 태그(<trace>/<answer>/<prob/>/<chips>) 증분 파서.
 * 화면 표시용 투영이며 API 계약이 아니다. 모델 출력은 신뢰하지 않는다:
 * 닫는 태그 누락·청크 중간 절단·깨진 JSON 전부 크래시 없이 복구하거나 무시한다.
 * 값 검증(prob 합계, chips 스키마)은 src/teth-chips-schema.ts 의 몫이다. */

export type TethParseEvent =
  | { kind: 'trace-step'; label: string }
  | { kind: 'answer-open' }
  | { kind: 'answer-delta'; text: string }
  | { kind: 'answer-close' }
  | { kind: 'prob-raw'; up: string; down: string }
  | { kind: 'chips-raw'; raw: string }
  | { kind: 'drop'; reason: string }

export type TethStreamParser = {
  push(chunk: string): TethParseEvent[]
  finish(): TethParseEvent[]
}

const FIXED_TAGS = ['<trace>', '</trace>', '<answer>', '</answer>', '<chips>', '</chips>'] as const
const CLOSE_CHIPS = '</chips>'
const PROB_HEAD = '<prob'
const PROB_HOLD_MAX = 96
const CHIPS_MAX = 8192
const TRACE_MAX = 200

type Mode = 'pre' | 'trace' | 'answer' | 'post' | 'chips'

type TagMatch =
  | { kind: 'full'; tag: (typeof FIXED_TAGS)[number]; length: number }
  | { kind: 'full-prob'; length: number; up: string; down: string }
  | { kind: 'partial' }
  | { kind: 'none' }

function matchTag(rest: string): TagMatch {
  for (const tag of FIXED_TAGS) {
    if (rest.startsWith(tag)) return { kind: 'full', tag, length: tag.length }
  }
  if (rest.startsWith(PROB_HEAD)) {
    // '<probable' 같은 다른 단어를 태그로 오인하지 않는다.
    const after = rest.charAt(PROB_HEAD.length)
    if (after && /[A-Za-z0-9]/.test(after)) return { kind: 'none' }
    const gt = rest.indexOf('>')
    if (gt === -1) return rest.length > PROB_HOLD_MAX ? { kind: 'none' } : { kind: 'partial' }
    // '/>' 누락 후 한참 뒤의 산문 속 '>' 까지 속성으로 삼켜 본문을 지우면 안 된다.
    if (gt > PROB_HOLD_MAX) return { kind: 'none' }
    const attrs = rest.slice(PROB_HEAD.length, gt)
    const up = /\bup\s*=\s*"?([^"\s/>]+)"?/.exec(attrs)?.[1] ?? ''
    const down = /\bdown\s*=\s*"?([^"\s/>]+)"?/.exec(attrs)?.[1] ?? ''
    return { kind: 'full-prob', length: gt + 1, up, down }
  }
  for (const tag of [...FIXED_TAGS, PROB_HEAD]) {
    if (tag.startsWith(rest)) return { kind: 'partial' }
  }
  return { kind: 'none' }
}

export function createTethStreamParser(): TethStreamParser {
  let mode: Mode = 'pre'
  let carry = ''
  let traceLabel = ''
  let traceReturn: Mode = 'pre'
  let chipsRaw = ''
  let chipsOverflow = false
  let chipsReturn: Mode = 'post'
  // 각 텍스트 채널의 선두 공백은 프로즈 시작 전까지 버리고, 시작 후엔 원문 그대로 흘린다.
  const prose = { pre: false, answer: false, post: false }

  function emitText(events: TethParseEvent[], text: string) {
    if (!text) return
    if (mode === 'trace') {
      traceLabel += text
      // 라벨이 아니라 본문이 잘못 흘러든 경우(닫는 태그·<answer> 동시 누락):
      // 통째로 스텝 제목이 되어 실제 답변이 폴백으로 대체되는 것을 막는다.
      if (traceLabel.length > TRACE_MAX) {
        const spill = traceLabel
        traceLabel = ''
        mode = traceReturn
        events.push({ kind: 'drop', reason: 'trace-overflow' })
        emitText(events, spill)
      }
      return
    }
    if (mode === 'pre' || mode === 'answer' || mode === 'post') {
      if (!prose[mode]) {
        const trimmed = text.replace(/^\s+/, '')
        if (!trimmed) return
        prose[mode] = true
        events.push({ kind: 'answer-delta', text: trimmed })
        return
      }
      events.push({ kind: 'answer-delta', text })
    }
    // chips 모드 텍스트는 process() 안에서 chipsRaw 로만 쌓인다.
  }

  function commitTrace(events: TethParseEvent[]) {
    const label = traceLabel.trim()
    traceLabel = ''
    if (label) events.push({ kind: 'trace-step', label })
  }

  function applyTag(events: TethParseEvent[], match: TagMatch) {
    if (match.kind === 'full-prob') {
      if (mode === 'trace') return // 트레이스 라벨 안의 prob 은 무시한다
      events.push({ kind: 'prob-raw', up: match.up, down: match.down })
      return
    }
    if (match.kind !== 'full') return
    switch (match.tag) {
      case '<trace>':
        if (mode === 'trace') commitTrace(events) // 닫는 태그 누락 복구
        else traceReturn = mode === 'answer' ? 'answer' : mode === 'post' ? 'post' : 'pre'
        mode = 'trace'
        break
      case '</trace>':
        if (mode === 'trace') { commitTrace(events); mode = traceReturn }
        break
      case '<answer>':
        if (mode === 'trace') { commitTrace(events) }
        events.push({ kind: 'answer-open' })
        mode = 'answer'
        break
      case '</answer>':
        if (mode === 'answer') { events.push({ kind: 'answer-close' }); mode = 'post' }
        break
      case '<chips>':
        if (mode === 'trace') commitTrace(events)
        chipsReturn = mode === 'answer' ? 'answer' : 'post'
        mode = 'chips'
        chipsRaw = ''
        chipsOverflow = false
        break
      case '</chips>':
        // chips 모드의 닫힘은 아래 chips 전용 스캔이 처리한다. 그 외 위치의 잔여 태그는 무시.
        break
    }
  }

  function appendChips(events: TethParseEvent[], text: string) {
    if (chipsOverflow) return
    if (chipsRaw.length + text.length > CHIPS_MAX) {
      chipsOverflow = true
      events.push({ kind: 'drop', reason: 'chips-too-large' })
      return
    }
    chipsRaw += text
  }

  function process(chunk: string): TethParseEvent[] {
    const events: TethParseEvent[] = []
    let work = carry + chunk
    carry = ''
    let i = 0
    while (i < work.length) {
      if (mode === 'chips') {
        // chips 본문 안에서는 닫는 태그만 찾는다 — JSON 내부 '<' 를 태그로 오인하지 않는다.
        const close = work.indexOf(CLOSE_CHIPS, i)
        if (close !== -1) {
          appendChips(events, work.slice(i, close))
          if (!chipsOverflow) events.push({ kind: 'chips-raw', raw: chipsRaw })
          chipsRaw = ''
          mode = chipsReturn
          i = close + CLOSE_CHIPS.length
          continue
        }
        // 청크 경계에서 잘린 '</chips>' 접두 꼬리는 다음 push 로 이월한다.
        let keep = 0
        for (let k = Math.min(CLOSE_CHIPS.length - 1, work.length - i); k > 0; k--) {
          if (CLOSE_CHIPS.startsWith(work.slice(work.length - k))) { keep = k; break }
        }
        appendChips(events, work.slice(i, work.length - keep))
        carry = keep ? work.slice(work.length - keep) : ''
        return events
      }
      const lt = work.indexOf('<', i)
      if (lt === -1) { emitText(events, work.slice(i)); break }
      if (lt > i) emitText(events, work.slice(i, lt))
      const rest = work.slice(lt)
      const match = matchTag(rest)
      if (match.kind === 'partial') { carry = rest; return events }
      if (match.kind === 'none') { emitText(events, '<'); i = lt + 1; continue }
      i = lt + match.length
      applyTag(events, match)
      // 태그가 모드를 바꿨을 수 있으므로 루프 선두에서 재분기한다.
      work = work.slice(i)
      i = 0
    }
    return events
  }

  return {
    push: (chunk: string) => process(chunk),
    finish: () => {
      const events: TethParseEvent[] = []
      if (mode === 'chips') {
        events.push({ kind: 'drop', reason: 'unterminated-chips' })
        chipsRaw = ''
        mode = chipsReturn
      } else if (carry) {
        // 미완성 태그 잔재는 본문 텍스트로 방류한다 — 내용을 잃지 않는다.
        const leftover = carry
        carry = ''
        emitText(events, leftover)
      }
      if (mode === 'trace') { commitTrace(events); mode = traceReturn }
      if (mode === 'answer') events.push({ kind: 'answer-close' })
      carry = ''
      return events
    },
  }
}
