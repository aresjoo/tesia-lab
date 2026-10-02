import { expect, test, type Page } from '@playwright/test'

const locales = [
  { code: 'ko', menu: '대화 메뉴', rename: '이름 변경', save: '저장', remove: '삭제', chat: '대화', send: '메시지 보내기', edit: '대화 제목 수정', copy: '답변 복사', copied: '답변 복사 완료', good: '좋은 답변', row: '연구 관리', cancel: '취소', draft: '초안' },
  { code: 'en', menu: 'Conversation menu', rename: 'Rename', save: 'Save', remove: 'Delete', chat: 'Chat', send: 'Send message', edit: 'Edit conversation title', copy: 'Copy answer', copied: 'Answer copied', good: 'Good answer', row: 'Manage research', cancel: 'Cancel', draft: 'Draft' },
  { code: 'ja', menu: '会話メニュー', rename: '名前を変更', save: '保存', remove: '削除', chat: '会話', send: 'メッセージを送信', edit: '会話のタイトルを編集', copy: '回答をコピー', copied: '回答をコピーしました', good: '良い回答', row: '研究の管理', cancel: 'キャンセル', draft: '下書き' },
  { code: 'zh-CN', menu: '对话菜单', rename: '重命名', save: '保存', remove: '删除', chat: '对话', send: '发送消息', edit: '编辑对话标题', copy: '复制回答', copied: '回答已复制', good: '回答不错', row: '管理研究', cancel: '取消', draft: '草稿' },
  { code: 'zh-TW', menu: '對話選單', rename: '重新命名', save: '儲存', remove: '刪除', chat: '對話', send: '傳送訊息', edit: '編輯對話標題', copy: '複製回答', copied: '回答已複製', good: '回答不錯', row: '管理研究', cancel: '取消', draft: '草稿' },
  { code: 'es', menu: 'Menú de conversación', rename: 'Cambiar nombre', save: 'Guardar', remove: 'Eliminar', chat: 'Conversación', send: 'Enviar mensaje', edit: 'Editar título de conversación', copy: 'Copiar respuesta', copied: 'Respuesta copiada', good: 'Buena respuesta', row: 'Gestionar investigación', cancel: 'Cancelar', draft: 'Borrador' },
  { code: 'fr', menu: 'Menu de conversation', rename: 'Renommer', save: 'Enregistrer', remove: 'Supprimer', chat: 'Conversation', send: 'Envoyer le message', edit: 'Modifier le titre de la conversation', copy: 'Copier la réponse', copied: 'Réponse copiée', good: 'Bonne réponse', row: 'Gérer la recherche', cancel: 'Annuler', draft: 'Brouillon' },
] as const

async function seed(page: Page, status: 'done' | 'running' = 'done') {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(status => {
    const turn = { id: 'locale-turn', question: '비트코인 조건 원문', answer: status === 'done' ? '응답 원문을 그대로 보존합니다.' : '', fullAnswer: '응답 원문을 그대로 보존합니다.', status, startedAt: status === 'running' ? Date.now() + 60_000 : 1, finishedAt: status === 'done' ? 100 : undefined, suggestions: [], phase: 'plan' }
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'Locale QA', email: 'locale@example.test' }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: 'locale-session', homeDraft: '', sessions: [{ id: 'locale-session', title: '사용자 지정 제목', renamed: true, idea: turn.question, draft: '원문 초안 보존', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'conversation', researchStatus: '초안', turns: [turn], updatedAt: 1 }] }))
  }, status)
  await page.goto('/')
  await expect(page.locator('.g-composer textarea')).toHaveValue('원문 초안 보존')
  // Hold the real publisher once. Repeated dynamic-import evaluate promises
  // can be collected by the browser even after the preference was applied;
  // language interaction itself is synchronous, just like the settings UI.
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(path)
    Reflect.set(window, 'conversationLocalePreferencePublisher', setClientPreference)
  })
}

// Exercise the actual preference publisher without shifting focus to a modal.
async function language(page: Page, code: string) {
  await page.evaluate(code => Reflect.get(window, 'conversationLocalePreferencePublisher')('language', code), code)
  await expect(page.locator('html')).toHaveAttribute('lang', code)
}

test('대화 조작 7언어 전환은 원문·제목·초안·평가를 유지한다', async ({ page }) => {
  await seed(page)
  const answer = await page.locator('.g-amsg').innerText()
  await page.getByRole('button', { name: '좋은 답변', exact: true }).click()
  for (const item of locales) {
    await language(page, item.code)
    await expect(page.getByRole('button', { name: item.send, exact: true })).toBeVisible()
    await expect(page.locator('.g-tabs').getByRole('button', { name: item.chat, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: item.good, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: item.copy, exact: true })).toBeVisible()
    await expect(page.locator('.g-title')).toHaveText('사용자 지정 제목')
    await expect(page.locator('.g-umsg')).toHaveText('비트코인 조건 원문')
    await expect(page.locator('.g-thread')).toContainText('응답 원문을 그대로 보존합니다.')
    await expect(page.locator('.g-composer textarea')).toHaveValue('원문 초안 보존')
    await page.getByRole('button', { name: item.menu, exact: true }).click()
    await expect(page.locator('.client-session-pop').getByRole('button', { name: item.rename, exact: true })).toBeFocused()
    await page.locator('.client-session-pop').getByRole('button', { name: item.remove, exact: true }).click()
    await expect(page.locator('.client-session-pop .danger')).not.toHaveText(item.remove)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: item.menu, exact: true })).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await language(page, 'ko')
  expect(await page.locator('.g-amsg').innerText()).toBe(answer)
})

test('제목 편집 중 언어 변경은 조합 입력·커서·미저장 원문을 보존한다', async ({ page }) => {
  await seed(page)
  await page.getByRole('button', { name: '대화 제목 수정', exact: true }).click()
  const title = page.locator('.g-title-input')
  await title.fill('편집 중 제목')
  await title.evaluate(input => input.setSelectionRange(2, 4))
  await language(page, 'en')
  await expect(title).toHaveValue('편집 중 제목')
  await expect(title).toBeFocused()
  expect(await title.evaluate(input => [input.selectionStart, input.selectionEnd])).toEqual([2, 4])
  await title.dispatchEvent('keydown', { key: 'Escape', isComposing: true })
  await expect(title).toBeVisible()
  await title.press('Escape')
  await expect(page.locator('.g-title')).toHaveText('사용자 지정 제목')
  await page.getByRole('button', { name: 'Conversation menu', exact: true }).click()
  await page.getByRole('button', { name: 'Rename', exact: true }).click()
  const input = page.locator('.client-session-pop input')
  await input.fill('메뉴 편집 원문')
  for (const item of locales) {
    await language(page, item.code)
    await expect(input).toHaveValue('메뉴 편집 원문')
    await expect(input).toBeFocused()
    await expect(page.locator('.client-session-pop').getByRole('button', { name: item.save, exact: true })).toBeVisible()
  }
  await input.dispatchEvent('keydown', { key: 'Escape', isComposing: true })
  await expect(input).toBeVisible()
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.locator('.g-title')).toHaveText('메뉴 편집 원문')
  await expect(page.getByRole('button', { name: 'Menu de conversation', exact: true })).toBeFocused()
  await expect(page.locator('.g-composer textarea')).toHaveValue('원문 초안 보존')
})

for (const target of ['answer', 'question'] as const) {
  test(`${target} 복사 결과는 현재 언어를 따르고 뒤늦은 실패가 성공을 덮지 않는다`, async ({ page }) => {
    await seed(page)
    await page.evaluate(() => {
      const pending: { resolve: () => void; reject: (reason: Error) => void }[] = []
      Object.assign(window, { localeCopies: pending })
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise<void>((resolve, reject) => pending.push({ resolve, reject })) } })
    })
    const area = page.locator(target === 'answer' ? '.client-answer-actions' : '.g-uacts')
    const button = area.locator('button').last()
    await button.click()
    await language(page, 'en')
    await page.evaluate(() => Reflect.get(window, 'localeCopies')[0].reject(new Error('denied')))
    const error = page.locator(target === 'answer' ? '.client-answer-actions .answer-copy-error' : '.g-copy-error')
    await expect(error).toHaveText('Please check clipboard permissions.')
    await language(page, 'fr')
    await expect(error).toHaveText('Vérifiez les autorisations du presse-papiers.')
    await button.click()
    await button.click()
    await page.evaluate(() => Reflect.get(window, 'localeCopies')[2].resolve())
    await language(page, 'ja')
    await expect(button).toHaveAttribute('aria-label', target === 'answer' ? '回答をコピーしました' : 'メッセージをコピーしました')
    await page.evaluate(() => Reflect.get(window, 'localeCopies')[1].reject(new Error('old failure')))
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(error).toHaveCount(0)
    await expect(button).toHaveAttribute('aria-label', target === 'answer' ? '回答をコピーしました' : 'メッセージをコピーしました')
  })
}

test('연구 행 메뉴·이름 변경·삭제 확인은 7언어에서 원문과 포커스를 보존한다', async ({ page }) => {
  await seed(page)
  await page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
  const trigger = page.locator('.client-session-dots').first()
  for (const item of locales) {
    await language(page, item.code)
    await expect(page.locator('.client-session-state').first()).toHaveText(item.draft)
    await trigger.click()
    await expect(page.getByRole('menu', { name: item.row, exact: true })).toBeVisible()
    await page.getByRole('menuitem', { name: item.rename, exact: true }).click()
    const dialog = page.locator('.client-rowdialog')
    await dialog.locator('input').fill('保持 原文 abc')
    await language(page, 'en')
    await expect(dialog.locator('input')).toHaveValue('保持 原文 abc')
    await expect(dialog.locator('input')).toBeFocused()
    await dialog.locator('input').dispatchEvent('keydown', { key: 'Escape', isComposing: true })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(trigger).toBeFocused()
    await language(page, item.code)
    await trigger.click()
    await page.getByRole('menuitem', { name: item.remove, exact: true }).click()
    await expect(dialog.getByRole('button', { name: item.cancel, exact: true })).toBeFocused()
    await expect(dialog.getByRole('button', { name: item.remove, exact: true })).toBeVisible()
    await expect(dialog.locator('p')).not.toBeEmpty()
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await dialog.getByRole('button', { name: item.cancel, exact: true }).click()
    await expect(trigger).toBeFocused()
    await expect(page.locator('.client-session').first()).toContainText('사용자 지정 제목')
  }
})

test('진행 중 대화 언어 전환은 중지 동작과 초안·조합 입력을 유지한다', async ({ page }) => {
  await seed(page, 'running')
  const input = page.locator('.g-composer textarea')
  await input.focus()
  await language(page, 'en')
  await expect(input).toBeFocused()
  await expect(page.locator('.g-thread')).toContainText('Organizing thoughts')
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
  await expect(page.locator('.g-umsg')).toHaveCount(1)
  await page.getByRole('button', { name: 'Stop response', exact: true }).click()
  await expect(page.getByText('The response was stopped.', { exact: true })).toBeVisible()
  await language(page, 'ja')
  await expect(page.getByText('応答を停止しました。', { exact: true })).toBeVisible()
  await expect(input).toHaveValue('원문 초안 보존')
})

test('저장 실패 알림은 열린 상태에서도 언어를 갱신하고 미저장 초안을 보존한다', async ({ page }) => {
  await seed(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'teth-client-experience') throw new DOMException('Blocked', 'SecurityError')
      return original.call(this, key, value)
    }
  })
  const input = page.locator('.g-composer textarea')
  await input.fill('저장 실패 중 작성한 原文')
  await expect(page.locator('.client-global-notice')).toContainText('이 탭에 변경 내용을 저장하지 못했습니다.')
  await language(page, 'en')
  await expect(page.locator('.client-global-notice')).toContainText('Changes could not be saved in this tab.')
  await language(page, 'ja')
  await expect(page.locator('.client-global-notice')).toContainText('このタブに変更を保存できませんでした。')
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('저장 실패 중 작성한 原文')
  await page.getByRole('button', { name: '通知を閉じる', exact: true }).click()
  await expect(page.locator('.client-global-notice')).toHaveCount(0)
  await expect(input).toHaveValue('저장 실패 중 작성한 原文')
})
