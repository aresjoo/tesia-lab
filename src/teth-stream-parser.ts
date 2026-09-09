/* TETH 답변 스트림의 구조 태그(<say>/<work>/<item>/<prob/>/<chips>) 증분 파서.
 * 화면 표시용 투영이며 API 계약이 아니다. 모델 출력은 신뢰하지 않는다.
 *
 * 직전 세션 버그 클래스의 구조적 일반화 (tests/teth-stream-parser.spec.ts 가 증명):
 *  ① 속성 태그(<work ...>, <prob ...>)의 '>' 탐색은 ATTR_MAX 상한 안에서만 —
 *     셀프클로즈/닫는 괄호 누락이 이후 산문을 속성으로 삼키지 못한다.
 *  ② 모든 축적 버퍼에 길이 상한(item 라벨 ITEM_MAX, chips CHIPS_MAX) —
 *     미종결 태그가 응답 전체를 흡수하지 못하고 일반 텍스트/절단으로 복구된다.
 *  ③ 커밋 빈도는 파서 밖(컨트롤러 80ms 통합 스로틀) 책임 — 파서는 이벤트만 낸다.
 * 태그 밖 텍스트의 기본 채널은 say 다 — 모델이 태그를 빼먹어도 화면이 비지 않는다.
 * 깨진 태그·청크 절단·불량 JSON 전부 크래시 없이 복구하거나 무시한다. 절대 throw 금지. */

export type TethParseEvent =
  | { kind: 'say-open'; implicit?: true }
  | { kind: 'say-delta'; text: string }
  | { kind: 'say-close' }
  | { kind: 'work-open'; model: string; role: string }
  | { kind: 'item'; label: string }
  | { kind: 'work-close' }
  | { kind: 'prob-raw'; up: string; down: string }
  | { kind: 'chips-raw'; raw: string }
  | { kind: 'drop'; reason: string }

export type TethStreamParser = {
  push(chunk: string): TethParseEvent[]
  finish(): TethParseEvent[]
}

const FIXED_TAGS = ['<say>', '</say>', '</work>', '<item>', '</item>', '<chips>', '</chips>'] as const
const ATTR_HEADS = ['<work', '<prob'] as const
const CLOSE_CHIPS = '</chips>'
const ATTR_MAX = 192   // 속성부 '>' 탐색 상한 (버그 클래스 ①)
const ITEM_MAX = 200   // item 라벨 상한 (버그 클래스 ②)
const CHIPS_MAX = 8192

type Mode = 'idle' | 'say' | 'work' | 'item' | 'chips'

type TagMatch =
  | { kind: 'fixed'; tag: (typeof FIXED_TAGS)[number]; length: number }
  | { kind: 'attr'; head: (typeof ATTR_HEADS)[number]; length: number; attrs: string; selfClosed: boolean }
  | { kind: 'partial' }
  | { kind: 'none' }

function matchTag(rest: string): TagMatch {
  for (const tag of FIXED_TAGS) {
    if (rest.startsWith(tag)) return { kind: 'fixed', tag, length: tag.length }
  }
  for (const head of ATTR_HEADS) {
    if (!rest.startsWith(head)) continue
    const after = rest.charAt(head.length)
    if (after && /[A-Za-z0-9]/.test(after)) return { kind: 'none' } // '<workaround' 류 오인 방지
    const gt = rest.indexOf('>')
    if (gt === -1) return rest.length > ATTR_MAX ? { kind: 'none' } : { kind: 'partial' }
    if (gt > ATTR_MAX) return { kind: 'none' }
    const raw = rest.slice(head.length, gt)
    const selfClosed = raw.trimEnd().endsWith('/')
    return { kind: 'attr', head, length: gt + 1, attrs: raw, selfClosed }
  }
  for (const tag of [...FIXED_TAGS, ...ATTR_HEADS]) {
    if (tag.startsWith(rest)) return { kind: 'partial' }
  }
  return { kind: 'none' }
}

const readAttr = (attrs: string, name: string): string => {
  const found = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|([^\\s"/>]+))`).exec(attrs)
  return found ? (found[1] ?? found[2] ?? '') : ''
}

export function createTethStreamParser(): TethStreamParser {
  let mode: Mode = 'idle'
  let carry = ''
  let sayOpen = false        // 명시적이든 암시적이든 say 세그먼트가 열려 있는가
  let sayProse = false       // 열린 say 에 프로즈가 시작됐는가 (선두 공백 트림용)
  let itemLabel = ''
  let itemOverflow = false
  let workStray = ''         // work 안·item 밖의 떠도는 텍스트 → 줄 단위로 item 승격
  let chipsRaw = ''
  let chipsOverflow = false

  function openSay(events: TethParseEvent[], implicit: boolean) {
    if (sayOpen) return
    sayOpen = true
    sayProse = false
    events.push(implicit ? { kind: 'say-open', implicit: true } : { kind: 'say-open' })
  }

  function closeSay(events: TethParseEvent[]) {
    if (!sayOpen) return
    sayOpen = false
    sayProse = false // 다음 세그먼트 사이의 공백이 say 로 새지 않게 초기화
    events.push({ kind: 'say-close' })
  }

  function commitItem(events: TethParseEvent[]) {
    const label = itemLabel.trim().slice(0, ITEM_MAX)
    itemLabel = ''
    itemOverflow = false
    if (label) events.push({ kind: 'item', label })
  }

  function commitWorkStray(events: TethParseEvent[], flushAll: boolean) {
    // 모델이 <item> 없이 줄만 나열한 경우의 관대 복구: 줄 단위로 item 승격
    for (;;) {
      const nl = workStray.indexOf('\n')
      if (nl === -1) break
      const line = workStray.slice(0, nl).trim()
      workStray = workStray.slice(nl + 1)
      if (line) events.push({ kind: 'item', label: line.slice(0, ITEM_MAX) })
    }
    if (workStray.length > ITEM_MAX) {
      events.push({ kind: 'item', label: workStray.trim().slice(0, ITEM_MAX) })
      workStray = ''
    }
    if (flushAll) {
      const line = workStray.trim()
      workStray = ''
      if (line) events.push({ kind: 'item', label: line.slice(0, ITEM_MAX) })
    }
  }

  function emitText(events: TethParseEvent[], text: string) {
    if (!text) return
    switch (mode) {
      case 'item':
        if (itemOverflow) return
        itemLabel += text
        if (itemLabel.length > ITEM_MAX) { itemOverflow = true; events.push({ kind: 'drop', reason: 'item-overflow' }) }
        return
      case 'work':
        workStray += text
        commitWorkStray(events, false)
        return
      case 'idle':
      case 'say': {
        let out = text
        if (!sayOpen || !sayProse) {
          if (!sayProse) out = out.replace(/^\s+/, '')
          if (!out) return
          if (!sayOpen) openSay(events, true)
          sayProse = true
        }
        events.push({ kind: 'say-delta', text: out })
        return
      }
      // chips 텍스트는 process() 의 chips 전용 스캔이 쌓는다.
    }
  }

  function closeWork(events: TethParseEvent[]) {
    if (mode === 'item') commitItem(events)
    commitWorkStray(events, true)
    events.push({ kind: 'work-close' })
    mode = 'idle'
  }

  function applyTag(events: TethParseEvent[], match: TagMatch) {
    if (match.kind === 'attr') {
      if (match.head === '<prob') {
        // prob 는 위치 무관 셀프클로즈 — say 내부/외부 어디서든 이벤트만 낸다.
        if (mode === 'chips') return
        if (mode === 'item' || mode === 'work') return // work 카드 안의 prob 은 무시
        events.push({ kind: 'prob-raw', up: readAttr(match.attrs, 'up'), down: readAttr(match.attrs, 'down') })
        return
      }
      // <work ...>
      if (mode === 'item') commitItem(events)
      if (mode === 'work') closeWork(events)
      closeSay(events)
      events.push({ kind: 'work-open', model: readAttr(match.attrs, 'model'), role: readAttr(match.attrs, 'role') })
      mode = match.selfClosed ? 'idle' : 'work'
      if (match.selfClosed) events.push({ kind: 'work-close' })
      else { workStray = '' }
      return
    }
    if (match.kind !== 'fixed') return
    switch (match.tag) {
      case '<say>':
        if (mode === 'item') { commitItem(events); closeWork(events) }
        else if (mode === 'work') closeWork(events)
        closeSay(events) // 이전 say(명시/암시)가 열려 있으면 새 세그먼트로 교체
        openSay(events, false)
        mode = 'say'
        break
      case '</say>':
        closeSay(events)
        mode = 'idle'
        break
      case '<item>':
        if (mode === 'work') { commitWorkStray(events, true); mode = 'item'; itemLabel = ''; itemOverflow = false }
        else if (mode === 'item') { commitItem(events) } // 닫는 태그 누락 복구
        else emitText(events, '<item>') // work 밖의 item 은 리터럴 취급
        break
      case '</item>':
        if (mode === 'item') { commitItem(events); mode = 'work' }
        break
      case '</work>':
        if (mode === 'item') { commitItem(events); mode = 'work' }
        if (mode === 'work') closeWork(events)
        break
      case '<chips>':
        if (mode === 'item') { commitItem(events); closeWork(events) }
        else if (mode === 'work') closeWork(events)
        closeSay(events)
        mode = 'chips'
        chipsRaw = ''
        chipsOverflow = false
        break
      case '</chips>':
        break // chips 모드 밖의 잔여 닫는 태그는 무시
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
        // chips 본문에서는 닫는 태그만 찾는다 — JSON 내부 '<' 를 태그로 오인하지 않는다.
        const close = work.indexOf(CLOSE_CHIPS, i)
        if (close !== -1) {
          appendChips(events, work.slice(i, close))
          if (!chipsOverflow) events.push({ kind: 'chips-raw', raw: chipsRaw })
          chipsRaw = ''
          mode = 'idle'
          i = close + CLOSE_CHIPS.length
          continue
        }
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
        mode = 'idle'
      } else if (carry) {
        const leftover = carry
        carry = ''
        emitText(events, leftover) // 미완성 태그 잔재는 텍스트로 방류 — 내용을 잃지 않는다
      }
      if (mode === 'item') { commitItem(events); mode = 'work' }
      if (mode === 'work') closeWork(events)
      closeSay(events)
      carry = ''
      return events
    },
  }
}
