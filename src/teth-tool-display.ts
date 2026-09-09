/* 사고 패널의 tool 활동 번역·집계 레이어 — 화면 표시용 투영이며 API 계약이 아니다.
 * 원칙(TETH 공통): 어려운 단어 금지. 내부 tool ID·검색 쿼리 원문·전체 URL 을
 * 어떤 경우에도 라벨에 노출하지 않는다.
 * code_execution 은 "생성 시점 태깅" 방식이다: 실행을 요청하는 쪽이 purpose
 * 메타데이터("지지선 레벨 계산" 등)를 함께 보내면 그대로 쓰고, 없으면
 * "데이터 계산" 폴백. 사후 추출(코드 파싱·LLM 재호출)은 만들지 않는다. */

export type ToolActivityEvent = { name: string; query: string; purpose?: string }

/** 검색 쿼리 원문 대신 노출할 한국어 주제 키워드 표 (교체 가능 상수). */
const SEARCH_TOPICS: [RegExp, string][] = [
  [/비트코인|bitcoin|\bbtc\b/i, '비트코인'],
  [/이더리움|ethereum|\beth\b/i, '이더리움'],
  [/리플|ripple|\bxrp\b/i, '리플'],
  [/솔라나|solana|\bsol\b/i, '솔라나'],
  [/도지|doge/i, '도지코인'],
  [/금리|fed|fomc|cpi|물가/i, '거시 지표'],
  [/etf/i, 'ETF 흐름'],
]

/** tool 이벤트 1건 → 사용자용 한 줄 라벨. */
export function describeToolEvent(event: ToolActivityEvent): string {
  if (event.name === 'web_search') {
    const topic = SEARCH_TOPICS.find(([pattern]) => pattern.test(event.query))?.[1]
    return topic ? `시장 뉴스 확인: ${topic}` : '시장 뉴스 확인'
  }
  if (event.name === 'web_fetch') {
    try { return `출처 확인: ${new URL(event.query).hostname.replace(/^www\./, '')}` }
    catch { return '출처 확인' }
  }
  if (event.name === 'code_execution') {
    const purpose = event.purpose?.trim()
    return purpose ? purpose.slice(0, 60) : '데이터 계산'
  }
  // 미지의 tool 은 내부 ID 를 그대로 내보내지 않는다.
  return '데이터 확인'
}

/** 사고 패널 스텝과 호환되는 줄 형태 (store 의 AiTraceStep + 선택 detail). */
export type ToolActivityLine = { id: string; title: string; status: 'running' | 'done' | 'stopped'; detail?: string }

const MAX_LINES = 6

/** 라벨 시퀀스 → 패널 줄 목록. 동일 라벨 연속 N회는 "라벨 N회" 한 줄로 집계하고,
 * 줄 수가 상한을 넘으면 오래된 줄들을 "외 N개 작업" 한 줄(펼침 상세)로 접는다.
 * 마지막 줄은 스트림 진행 중일 때 running — 30초를 넘는 긴 구간에도 스톱워치
 * 대신 이 줄이 계속 갱신되며 "지금 무엇을 하는가"를 보여준다. */
export function aggregateToolActivity(labels: string[], streaming: boolean): ToolActivityLine[] {
  const grouped: { title: string; count: number }[] = []
  for (const label of labels) {
    const last = grouped.at(-1)
    if (last && last.title === label) last.count++
    else grouped.push({ title: label, count: 1 })
  }
  let lines: ToolActivityLine[] = grouped.map((group, index) => ({
    id: `tool-${index}`,
    title: group.count > 1 ? `${group.title} ${group.count}회` : group.title,
    status: 'done',
  }))
  if (lines.length > MAX_LINES) {
    const hidden = lines.slice(0, lines.length - (MAX_LINES - 1))
    lines = [
      { id: 'tool-overflow', title: `외 ${hidden.length}개 작업`, status: 'done', detail: hidden.map(line => line.title).join('\n') },
      ...lines.slice(lines.length - (MAX_LINES - 1)),
    ]
  }
  const last = lines.at(-1)
  if (last && streaming) last.status = 'running'
  return lines
}
