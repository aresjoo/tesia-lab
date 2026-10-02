import { expect, test } from '@playwright/test'
import { clientResearchAutoTitle, clientResearchLabel, previousResearchLabel } from '../src/client-research-label'

test('기존 문서 복귀는 7언어에서 새 결과의 계획 CTA와 구분한다', () => {
  const expected = { ko: '이전 연구 문서', en: 'Previous Research Doc', ja: '過去の研究文書', 'zh-CN': '先前研究文档', 'zh-TW': '先前研究文件', es: 'Doc. de investigación previo', fr: 'Doc. de recherche précédent' }
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    expect(previousResearchLabel(language)).toBe(expected[language])
    expect(previousResearchLabel(language)).not.toBe(clientResearchLabel('Research Plan', language))
  }
})

const session = { id: 'new', title: '새 전략', renamed: false, pair: 'BTC/USDT', mode: 'dip', idea: '원문 질문' }

test('원본 한국어 표시는 버전·내부 키·모르는 서버 표현을 변형하지 않는다', () => {
  const pairs = { 'Strategy Architect': '전략 설계', 'Quant Validator': '백테스트 검증', 'Sanity Check': '무결성 점검', 'Strategy Critic': '비판 검토', 'Risk Reviewer': '위험 심사', 'Market Context': '시장 데이터', Explanation: '쉬운 설명', 'Sealed Holdout': '봉인 구간', 'Research Verdict': '종합 판정', 'Research Plan': '연구 계획', 'Final Report': '검증 결과', Activity: '연구 과정', Hypothesis: '가설', 'Critic Review': '비판 검토 기록', 'Stress Test': '스트레스 테스트', 'Holdout Test': '봉인 구간 검증', 'Backtest v12': '백테스트 v12', 'Strategy v2': '전략 v2' }
  for (const [key, value] of Object.entries(pairs)) {
    expect(clientResearchLabel(key)).toBe(value)
    for (const locale of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) expect(clientResearchLabel(key, locale)).toBe(key)
  }
  for (const raw of ['__proto__', 'constructor', '알 수 없는 서버 역할', 'plan', 'bt2', '사용자가 쓴 Backtest v2 설명']) expect(clientResearchLabel(raw)).toBe(raw)
})

test('자동 제목은 원본 명칭·중복 접미사를 사용하며 사용자·레거시 제목은 보존한다', () => {
  expect(clientResearchAutoTitle(session, [])).toBe('비트코인 눌림목 줍기')
  expect(clientResearchAutoTitle({ ...session, pair: 'ETH/USDT', mode: 'trend' }, [])).toBe('이더리움 따라타기')
  const occupied = ['비트코인 눌림목 줍기', '비트코인 눌림목 줍기 2호'].map((title, i) => ({ ...session, id: `old-${i}`, title, renamed: true }))
  expect(clientResearchAutoTitle(session, occupied)).toBe('비트코인 눌림목 줍기 3호')
  const allocated = { ...session, title: '비트코인 눌림목 줍기 3호' }
  expect(clientResearchAutoTitle(allocated, [])).toBe(allocated.title)
  expect(clientResearchAutoTitle(allocated, [allocated])).toBe(allocated.title)
  expect(clientResearchAutoTitle(allocated, [{ ...allocated, id: 'manual', renamed: true }])).toBe(allocated.title)
  expect(clientResearchAutoTitle({ ...allocated, pair: 'ETH/USDT', mode: 'trend' }, [])).toBe('이더리움 따라타기')
  for (const renamed of [true, undefined]) expect(clientResearchAutoTitle({ ...session, title: '직접 정한 이름', renamed }, occupied)).toBe('직접 정한 이름')
  expect(clientResearchAutoTitle({ ...session, mode: 'unsupported', title: '기존 조건' }, [])).toBe('기존 조건')
  expect(clientResearchAutoTitle({ ...session, pair: '', idea: '가'.repeat(39) + '🔍뒤' }, [])).toBe('가'.repeat(39) + '🔍')
})

test('같은 tick에서 끝난 대화는 서로 다른 제목을 저장하고 재시작·다음 답변에도 유지한다', async ({ page }) => {
  // Isolate the store from the mounted application's background tick/persistence.
  await page.route('**/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }))
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const modulePath = '/src/client-experience-store.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ modulePath)
    const sessions = ['a', 'b', 'legacy'].map(id => ({ id, title: id === 'legacy' ? '기존의 이름' : '새 전략', ...(id === 'legacy' ? {} : { renamed: false }), idea: '원문', draft: '초안 유지', pair: 'BTC/USDT', mode: 'dip', timeframe: '일봉', risk: '-3%', takeProfit: '+8%', phase: 'plan', workspace: 'conversation', researchStatus: '초안', tradingReady: false, updatedAt: 1, turns: [{ id: `turn-${id}`, question: '원문', answer: '', fullAnswer: '결과', status: 'running', startedAt: 1, phase: 'plan', suggestions: [] }] }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ sessions, currentId: 'a', homeDraft: '' }))
    const store = createClientExperienceStore(); store.tick(20000)
    const first = store.getSnapshot().sessions.map((s: { title: string }) => s.title)
    const restored = createClientExperienceStore(); restored.send('조건은 그대로'); restored.tick(Date.now() + 20000)
    const final = restored.getSnapshot().sessions.map((s: { title: string; id: string; draft: string }) => ({ title: s.title, id: s.id, draft: s.draft }))
    return { first, final }
  })
  expect(result.first).toEqual(['비트코인 눌림목 줍기', '비트코인 눌림목 줍기 2호', '기존의 이름'])
  expect(result.final.map((s: { title: string }) => s.title)).toEqual(result.first)
  expect(result.final.map((s: { id: string }) => s.id)).toEqual(['a', 'b', 'legacy'])
  expect(result.final[1].draft).toBe('초안 유지')
})

test('저장된 문서 ID·질문 원문은 언어 전환·키보드 탐색·새로고침에도 그대로다', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('label-seeded')) return
    sessionStorage.setItem('label-seeded', '1')
    const id = 'label-check'
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{ id, title: '고객이 직접 지은 제목', renamed: true, idea: '원문 투자 아이디어', draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '-3%', takeProfit: '+8%', workspace: 'research', researchStatus: '검토 필요', turns: [], updatedAt: 1 }] }))
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({ seconds: 95, status: 'completed', view: 'activity', questions: [] }))
    sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({ active: 'critic', tabs: ['activity', 'plan', 'critic'], drafts: { critic: 'Research Plan이라는 원문은 번역하지 마세요' }, replies: [{ doc: 'critic', question: 'Strategy Critic 원문 질문', answer: '서버 역할 이름 원문' }] }))
  })
  await page.goto('/')
  await expect(page.getByRole('tab', { name: '비판 검토 기록', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('비판 검토 기록에 질문')).toHaveValue('Research Plan이라는 원문은 번역하지 마세요')
  await expect(page.locator('.rw-user-message')).toHaveText('Strategy Critic 원문 질문')
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', 'en') })
  await expect(page.getByRole('tab', { name: 'Critic Review', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('Critic Review에 질문')).toHaveValue('Research Plan이라는 원문은 번역하지 마세요')
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', 'ko') })
  const tab = page.getByRole('tab', { name: '비판 검토 기록', exact: true })
  await tab.focus()
  // Synthetic cancelable events isolate the component's handling from actual browser
  // history/OS shortcuts. No handler is replaced; the events bubble through React.
  const guardedEvents = await tab.evaluate(async button => {
    const cases: Array<{ name: string; init: KeyboardEventInit; prevented?: boolean }> = [
      { name: 'Alt', init: { altKey: true } },
      { name: 'Control', init: { ctrlKey: true } },
      { name: 'Meta', init: { metaKey: true } },
      { name: 'IME composing', init: { isComposing: true } },
      { name: 'IME 229', init: { keyCode: 229 } },
      { name: 'already handled', init: {}, prevented: true },
    ]
    const results = []
    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      for (const entry of cases) {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...entry.init })
        if (entry.prevented) event.preventDefault()
        const accepted = button.dispatchEvent(event)
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
        results.push({
          name: `${entry.name} ${key}`,
          accepted,
          prevented: event.defaultPrevented,
          expectedPrevented: Boolean(entry.prevented),
          selected: button.getAttribute('aria-selected'),
          focused: document.activeElement === button,
          draft: document.querySelector<HTMLTextAreaElement>('.rw-composer textarea')?.value,
        })
      }
    }
    return results
  })
  expect(guardedEvents).toHaveLength(24)
  for (const event of guardedEvents) {
    expect(event.accepted, event.name).toBe(!event.expectedPrevented)
    expect(event.prevented, event.name).toBe(event.expectedPrevented)
    expect(event.selected, event.name).toBe('true')
    expect(event.focused, event.name).toBe(true)
    expect(event.draft, event.name).toBe('Research Plan이라는 원문은 번역하지 마세요')
  }
  await tab.press('Home')
  await expect(page.getByRole('tab', { name: '연구 과정', exact: true })).toBeFocused()
  await expect(page.locator('.g-act .ag').first()).toHaveText('전략 설계')
  await expect(page.locator('.g-act .ag').first()).toHaveAttribute('data-agent', 'Strategy Architect')
  await expect(page.locator('.g-finding .k')).toHaveText(['쉽게 말하면', '전문가용 원문', '의미', '다음 행동'])
  await page.getByRole('tab', { name: '연구 과정', exact: true }).press('ArrowRight')
  await expect(page.getByRole('tab', { name: '연구 계획', exact: true })).toBeFocused()
  await page.getByRole('tab', { name: '연구 계획', exact: true }).press('ArrowLeft')
  await expect(page.getByRole('tab', { name: '연구 과정', exact: true })).toBeFocused()
  await page.getByRole('tab', { name: '연구 과정', exact: true }).press('ArrowLeft')
  await expect(tab).toBeFocused()
  await tab.press('ArrowRight')
  await expect(page.getByRole('tab', { name: '연구 과정', exact: true })).toBeFocused()
  await page.getByRole('tab', { name: '연구 과정', exact: true }).press('End')
  await page.reload()
  await expect(page.getByLabel('비판 검토 기록에 질문')).toHaveValue('Research Plan이라는 원문은 번역하지 마세요')
  const cache = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-research-documents:label-check')!))
  expect(cache.active).toBe('critic'); expect(cache.tabs).toEqual(['activity', 'plan', 'critic'])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await page.getByRole('button', { name: '대화 제목 수정', exact: true }).click()
  const titleInput = page.getByRole('textbox', { name: '대화 제목 수정', exact: true })
  await titleInput.fill(''); await titleInput.press('Enter')
  await expect(page.getByRole('button', { name: '대화 제목 수정', exact: true })).toHaveText('고객이 직접 지은 제목')
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions[0].renamed)).toBe(true)
})
