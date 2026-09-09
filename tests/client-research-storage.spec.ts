import { expect, test, type Page } from '@playwright/test'

async function seed(page: Page, blocked = false, completed = false) {
  await page.addInitScript(({ blocked, completed }) => {
    const id = 'storage-research'
    if (!sessionStorage.getItem('teth-client-experience')) {
      const turn = { id: 't', question: '아이디어', answer: '계획', fullAnswer: '계획', startedAt: 1, status: 'done', suggestions: [], phase: 'plan' }
      sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{ id, title: '저장 검수', idea: '비트코인 반등', draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'research', researchStatus: completed ? '검토 필요' : '초안', turns: [turn], updatedAt: 1 }] }))
      if (completed) sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({ seconds: 95, status: 'completed', view: 'activity', questions: [], clockVersion: 1 }))
    }
    if (blocked) {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function(key, value) {
        if (key.startsWith('teth-client-research-documents:') && !sessionStorage.getItem('allow-research-write')) throw new DOMException('Write blocked', 'QuotaExceededError')
        return original.call(this, key, value)
      }
    }
  }, { blocked, completed })
  await page.goto('/')
}

async function roundTrip(page: Page) {
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await page.getByRole('button', { name: /Research Plan 연구 계획 확인/ }).click()
}

test('연구 저장 실패에서도 초안·수정값·질문은 화면 왕복 후 유지되며 복구 후 저장된다', async ({ page }) => {
  await seed(page, true)
  await page.locator('.rw-composer textarea').fill('문서 질문을 먼저 전송')
  await page.getByRole('button', { name: '문서 질문 보내기' }).click()
  await page.locator('.rw-composer textarea').fill('보존할 문서 초안')
  await page.getByRole('button', { name: '손절 수정 요청', exact: true }).click()
  await page.getByRole('textbox', { name: '손절 코멘트' }).fill('2%')
  await page.getByRole('textbox', { name: '손절 코멘트' }).press('Enter')
  await roundTrip(page)
  await expect(page.locator('.rw-composer textarea')).toHaveValue('보존할 문서 초안')
  await expect(page.locator('.rw-user-message')).toHaveText('문서 질문을 먼저 전송')
  await expect(page.locator('.g-row').filter({ has: page.locator('.k', { hasText: /^손절$/ }) }).locator('.v')).toHaveText('−2%')
  await expect(page.locator('.rw-notice')).toContainText('브라우저 저장에 실패했습니다')
  await page.evaluate(() => sessionStorage.setItem('allow-research-write', '1'))
  await roundTrip(page)
  await expect(page.locator('.rw-notice')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.rw-composer textarea')).toHaveValue('보존할 문서 초안')
  await expect(page.locator('.rw-user-message')).toHaveText('문서 질문을 먼저 전송')
})

test('행 코멘트 초안은 문서별로 분리되어 탭·대화 왕복 및 새로고침을 견딘다', async ({ page }) => {
  await seed(page, false, true)
  const pick = async (name: string) => {
    await expect(page.locator('.rw-title')).toBeVisible()
    if (!(await page.getByRole('complementary', { name: '연구 아티팩트' }).isVisible())) await page.getByRole('button', { name: 'Artifacts 열기' }).click()
    await page.locator('.rw-artifact').filter({ hasText: new RegExp(`^${name}$`) }).click()
  }
  await page.getByRole('button', { name: '손절 수정 요청', exact: true }).click()
  await page.getByRole('textbox', { name: '손절 코멘트' }).fill('계획에 남기는 초안')
  await pick('Strategy v1')
  await page.getByRole('button', { name: '손절 수정 요청', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '손절 코멘트' })).toHaveValue('')
  await page.getByRole('textbox', { name: '손절 코멘트' }).fill('전략에 남기는 다른 초안')
  await pick('Research Plan')
  await page.getByRole('button', { name: '손절 수정 요청', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '손절 코멘트' })).toHaveValue('계획에 남기는 초안')
  await roundTrip(page)
  await page.getByRole('button', { name: '손절 수정 요청', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '손절 코멘트' })).toHaveValue('계획에 남기는 초안')
  await page.reload()
  await pick('Strategy v1')
  await page.getByRole('button', { name: '손절 수정 요청', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '손절 코멘트' })).toHaveValue('전략에 남기는 다른 초안')
  await page.getByRole('textbox', { name: '손절 코멘트' }).press('Enter')
  await page.getByRole('button', { name: '손절 수정 요청', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '손절 코멘트' })).toHaveValue('')
})

test('문서 임시 보관은 연구별로 분리되고 세션 삭제 시 같은 연구만 제거된다', async ({ page }) => {
  await seed(page, true)
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  const result = await page.evaluate(async () => {
    const cachePath = '/src/client-research-cache.ts'
    const storePath = '/src/client-experience-store.ts'
    const cache = await import(cachePath)
    const { createClientExperienceStore } = await import(storePath)
    const id = 'storage-research'
    const firstWrite = cache.writeResearchDocumentCache(id, { drafts: { plan: '첫 연구' } })
    cache.writeResearchDocumentCache('other-research', { drafts: { plan: '별도 연구' } })
    const originalGet = Storage.prototype.getItem
    Storage.prototype.getItem = function(key) { if (key.startsWith('teth-client-research-documents:')) throw new DOMException('Read blocked', 'SecurityError'); return originalGet.call(this, key) }
    const whileReadBlocked = cache.readResearchDocumentCache(id)
    Storage.prototype.getItem = originalGet
    const store = createClientExperienceStore()
    const removed = store.remove(id)
    return { firstWrite, whileReadBlocked, removed, deleted: cache.readResearchDocumentCache(id), other: cache.readResearchDocumentCache('other-research') }
  })
  expect(result).toEqual({ firstWrite: false, whileReadBlocked: { drafts: { plan: '첫 연구' } }, removed: true, deleted: null, other: { drafts: { plan: '별도 연구' } } })
})
