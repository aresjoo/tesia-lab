import { expect, test, type Locator, type Page } from '@playwright/test'
import type { ClientLanguage } from '../../src/client-preferences'

// 원본621cbed의 구조를 실제 NativeWorkspace/Conversation/ResponseSequence로 검증한다.
// 명시 합성 표시 입력이며 SDK·생산자·실제 전문 차트의 인수 시험은 아니다.
const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
// Independent expected chrome; do not import browser preferences/JSON into the
// Node test collector. The actual UI copy is loaded by Vite in the browser.
const unavailable: Record<ClientLanguage, string> = {
  ko: '연구 상태 미공급', en: 'Research status not supplied', ja: '研究状況は未提供です',
  'zh-CN': '未提供研究状态', 'zh-TW': '未提供研究狀態',
  es: 'Estado de investigación no proporcionado', fr: 'État de la recherche non fourni',
}
const title = '긴 원문 연구 제목: 비트코인 전략의 조건과 검증 범위를 문서·대화에서 함께 확인합니다'
const initialDraft = '보존할 초안과 선택 영역 0123456789'
const answer = '공급된 답변 원문입니다.\n실패·미공급 상태를 완료된 검증으로 바꾸지 않습니다.'

async function mount(page: Page, baseURL: string | undefined, width: number, language: ClientLanguage = 'ko', containerWidth?: number) {
  if (!baseURL) throw new Error('로컬 baseURL이 필요합니다.')
  const origin = new URL(baseURL).origin, errors: string[] = [], blocked: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort()
    }
    if (url.pathname === '/native-layout-fidelity.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture"></div></body></html>' })
    return route.continue()
  })
  await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(language => { localStorage.setItem('tethLang', language); localStorage.setItem('tethCurrency', 'USD') }, language)
  await page.goto('/native-layout-fidelity.html')
  await page.evaluate(async ({ title, initialDraft, answer, containerWidth }) => {
    const refreshPath = '/@react-refresh', refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/internal-poc/NativeResearchWorkspace.tsx'
    const source = await (await fetch(path)).text(), rp = source.match(/from "([^"\n]*\/react\.js[^"\n]*)"/)?.[1]
    if (!rp) throw new Error('Vite React 인스턴스를 찾지 못했습니다.')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, h = react.createElement
    const dp = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ dp)
    const conversationPath = '/src/components/ClientConversation.tsx', sequencePath = '/src/components/ClientResponseSequence.tsx'
    const preferencesPath = '/src/client-preferences.ts', copyPath = '/src/internal-poc/native-research-workspace-copy.ts'
    const { NativeResearchWorkspace } = await import(/* @vite-ignore */ path)
    const { ClientConversation } = await import(/* @vite-ignore */ conversationPath)
    const { ClientResponseSequence } = await import(/* @vite-ignore */ sequencePath)
    const { useClientPreferences, setClientPreference } = await import(/* @vite-ignore */ preferencesPath)
    const { nativeResearchText } = await import(/* @vite-ignore */ copyPath)
    for (const css of ['/node_modules/@fontsource-variable/noto-sans-kr/wght.css', '/src/internal-poc/client-service.css']) await import(/* @vite-ignore */ css)
    document.body.style.fontFamily = '"Noto Sans KR Variable", sans-serif'
    const calls: string[] = []
    function Host() {
      const { language } = useClientPreferences()
      const [input, setInput] = react.useState(initialDraft), [host, setHost] = react.useState(null)
      const [visible, setVisible] = react.useState(true), [analysisOpen, setAnalysisOpen] = react.useState(false)
      const [status, setStatus] = react.useState('unavailable'), [currentTitle, setTitle] = react.useState(title)
      const [view, setView] = react.useState({ activeDocumentId: 'plan', openDocumentIds: ['plan', 'report', 'activity'] })
      const [frameWidth, setFrameWidth] = react.useState(containerWidth ?? '100%')
      Object.assign(window, { nativeLayoutCalls: calls, nativeLayoutWidth: setFrameWidth,
        nativeLayoutVisibility: setVisible, nativeLayoutStatus: setStatus, nativeLayoutTitle: setTitle,
        nativeLayoutLanguage: (next: string) => setClientPreference('language', next),
        nativeLayoutView: setView,
      })
      const label = view.activeDocumentId === 'plan' ? '공급 계획' : view.activeDocumentId === 'report' ? '공급 보고서' : 'Activity'
      return h('div', { style: { width: frameWidth, maxWidth: '100%', height: '100dvh' }, 'data-layout-frame': '' },
        h('button', { id: 'native-layout-outside', style: { position: 'fixed', bottom: 0, left: 0, zIndex: 50 } }, '다른 화면의 초점'),
        h('div', { hidden: visible, style: { height: '100%' } }, h(ClientConversation, {
          value: input, onChange: setInput, onSend: () => calls.push('send'), onStop: () => calls.push('stop'), busy: false,
          inputLabel: '보존할 연구 입력', sendLabel: '명시 전송', titleLabel: '대화 제목', activityKey: 'layout-fixture',
          composerTarget: visible ? host : undefined,
          composerContext: visible ? nativeResearchText(language, 'composerContext', { label }) : undefined,
        })),
        h('div', { hidden: !visible, style: { height: '100%', minHeight: 0 } }, h(NativeResearchWorkspace, {
          scopeId: 'owner-a:conversation-a', title: currentTitle, visible, status, view, onViewChange: setView,
          onBack: () => setVisible(false), analysisOpen, onOpenAnalysis: () => setAnalysisOpen(true), onCloseAnalysis: () => setAnalysisOpen(false),
          // 명시 분석 슬롯: 차트 생성/가격 공급을 대신하지 않는다.
          analysis: h('section', { 'data-analysis-slot': '' }, h('h2', {}, '공급 분석 슬롯'), h('input', { 'aria-label': '분석 슬롯 초안', defaultValue: '유지할 분석 값' })),
          strategyDocument: h('section', {}, h('h3', {}, '공급 계획 본문'), h('input', { 'aria-label': '공급 문서 초안', defaultValue: '문서 입력 보존' })),
          documents: [{ id: 'report', title: 'Final Report', content: h('p', {}, '공급 보고서 본문') }],
          notice: status === 'failed' ? h('div', { role: 'alert' }, '명시 실패 안내 원문') : undefined,
          composerHasContext: true, composer: h('div', { ref: setHost, className: 'client-lab-conversation native-research-composer-host' }),
          threadEntriesForDocument: (id: string) => [{ id: `${id}:answer`, content: h(ClientResponseSequence, { source: 'service', blocks: [{ id: `${id}:text`, kind: 'text', text: answer, status: 'done' }] }) }],
        })),
      )
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(react.StrictMode, {}, h(Host)))
  }, { title, initialDraft, answer, containerWidth })
  await expect(page.locator('.native-research-workspace')).toBeVisible()
  await expect(page.locator('.native-research-composer-host textarea')).toHaveValue(initialDraft)
  await page.evaluate(() => document.fonts.ready)
  return { errors, blocked }
}

async function rect(locator: Locator) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox(); expect(box).not.toBeNull(); return box!
}
async function hit(locator: Locator) {
  const box = await rect(locator)
  expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44)
  expect(await locator.evaluate(element => {
    const b = element.getBoundingClientRect(), target = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
    return target === element || !!target && element.contains(target)
  })).toBe(true)
}
const workspace = (page: Page) => page.locator('.native-research-workspace')
const input = (page: Page) => page.getByRole('textbox', { name: '보존할 연구 입력', exact: true })

async function layout(page: Page, language: ClientLanguage, narrow: boolean) {
  const root = workspace(page), header = root.locator('.rw-header'), badge = header.locator('.g-tag')
  await expect(badge).toHaveText(unavailable[language])
  await expect(root.locator('.rw-heading [title]').first()).toHaveAttribute('title', title)
  expect(await badge.evaluate(element => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight)).toBe(true)
  const h = await rect(header), b = await rect(badge), tabs = await rect(header.locator('.rw-tabs'))
  // A 721px workspace still includes a 300px aside. Header wrapping follows
  // the actual document column, not the viewport or the aside breakpoint.
  const centerWidth = (await rect(root.locator('.rw-center'))).width
  if (centerWidth > 720) expect(h.height).toBeCloseTo(44, 1)
  else expect(h.height).toBeGreaterThanOrEqual(88)
  expect(b.y).toBeGreaterThanOrEqual(h.y); expect(b.y + b.height).toBeLessThanOrEqual(h.y + h.height)
  expect(Math.min(b.x + b.width, tabs.x + tabs.width) <= Math.max(b.x, tabs.x)
    || Math.min(b.y + b.height, tabs.y + tabs.height) <= Math.max(b.y, tabs.y)).toBe(true)
  if (centerWidth <= 480) {
    expect(tabs.y).toBeGreaterThanOrEqual(b.y + b.height)
    const contentWidth = await header.evaluate(element => {
      const style = getComputedStyle(element)
      return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    })
    expect(tabs.width).toBeCloseTo(contentWidth, 0)
  }
  await hit(header.getByRole('button').first())
  await hit(header.getByRole('tab', { selected: true }))
  const aux = root.locator('.rw-aux')
  if (narrow) {
    const trigger = header.locator('.rw-mobile-artifacts')
    await hit(trigger); await trigger.click(); await expect(aux).toBeVisible()
    await aux.locator('.rw-aux-heading button').click(); await expect(trigger).toBeFocused()
  } else expect((await rect(aux)).width).toBeCloseTo(300, 1)
  const form = root.locator('.native-research-composer-host .g-composer')
  const formBox = await rect(form), centerBox = await rect(root.locator('.rw-center'))
  expect(formBox.width).toBeLessThanOrEqual(840)
  expect(formBox.width).toBeLessThanOrEqual(centerBox.width)
  if (centerBox.width >= 876) expect(formBox.width).toBeCloseTo(840, 1)
  await expect(form.locator('.native-research-context')).toHaveCount(1)
  const response = root.locator('[role="tabpanel"]:visible .g-amsg').first()
  await response.scrollIntoViewIfNeeded()
  // Markdown paragraphs have separate visual lines, not newline text nodes.
  await expect(response.locator('p')).toHaveText(answer.split('\n'))
  await expect(response).toHaveCSS('font-size', '15.5px'); await expect(response).toHaveCSS('line-height', '27.9px')
  await expect(response).toHaveCSS('max-width', '720px')
  expect((await rect(response)).width).toBeLessThanOrEqual(720)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

for (const width of [320, 390, 1440]) for (const language of languages) {
  test(`Native 원본 레이아웃 ${width}px ${language}: 긴 상태·문서·입력·조작부를 보존한다`, async ({ page, baseURL }, info) => {
    const audit = await mount(page, baseURL, width, language)
    await layout(page, language, width <= 390)
    await page.screenshot({ path: info.outputPath(`native-layout-${width}-${language}.png`) })
    expect(audit).toEqual({ errors: [], blocked: [] })
    expect(await page.evaluate(() => Reflect.get(window, 'nativeLayoutCalls'))).toEqual([])
  })
}

for (const containerWidth of [720, 721]) {
  test(`1440 화면의 Native 컨테이너 ${containerWidth}px: viewport와 별개로 문서 패널을 배치한다`, async ({ page, baseURL }) => {
    const audit = await mount(page, baseURL, 1440, 'fr', containerWidth)
    expect((await rect(workspace(page))).width).toBeCloseTo(containerWidth, 1)
    await layout(page, 'fr', containerWidth <= 720)
    expect(audit).toEqual({ errors: [], blocked: [] })
  })
}

for (const containerWidth of [320, 480, 481, 721]) for (const language of languages) {
  test(`Native ${containerWidth}px 문서칼럼 ${language}: 모든 탭을 키보드로 선택하고 입력을 보존한다`, async ({ page, baseURL }, info) => {
    const audit = await mount(page, baseURL, 1440, language, containerWidth)
    const header = workspace(page).locator('.rw-header'), tabs = header.getByRole('tab')
    await input(page).evaluate(element => Reflect.set(window, 'tabRowInput', element))
    for (let i = 0; i < await tabs.count(); i++) {
      const tab = tabs.nth(i)
      await tab.focus()
      await tab.press('Enter')
      await expect(tab).toHaveAttribute('aria-selected', 'true')
      await expect(tab).toBeFocused()
      await expect(tab).toHaveCSS('outline-offset', '-2px')
      await hit(tab)
      const bounds = await tab.boundingBox(), row = await header.locator('.rw-tabs').boundingBox()
      expect(bounds!.x + bounds!.width / 2).toBeGreaterThanOrEqual(row!.x)
      expect(bounds!.x + bounds!.width / 2).toBeLessThanOrEqual(row!.x + row!.width)
      await expect(input(page)).toHaveValue(initialDraft)
      expect(await input(page).evaluate(element => element === Reflect.get(window, 'tabRowInput'))).toBe(true)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`native-tabs-${containerWidth}-${language}.png`) })
    expect(audit).toEqual({ errors: [], blocked: [] })
  })
}

for (const width of [320, 390, 1440]) {
  test(`Native ${width}px: 문서·분석 왕복 및 숨긴 뒤 변경에서 DOM·초안·선택과 외부 초점을 보존한다`, async ({ page, baseURL }) => {
    const audit = await mount(page, baseURL, width)
    await input(page).focus()
    await input(page).evaluate(element => {
      const field = element as HTMLTextAreaElement
      field.setSelectionRange(3, 12, 'forward'); Reflect.set(window, 'nativeLayoutInput', field)
    })
    await page.evaluate(() => { Reflect.get(window, 'nativeLayoutLanguage')('fr'); Reflect.get(window, 'nativeLayoutStatus')('failed') })
    await expect(workspace(page).getByRole('alert')).toHaveText('명시 실패 안내 원문')
    await expect(input(page)).toBeFocused()
    expect(await input(page).evaluate(element => {
      const field = element as HTMLTextAreaElement
      return [field === Reflect.get(window, 'nativeLayoutInput'), field.selectionStart, field.selectionEnd]
    })).toEqual([true, 3, 12])
    await page.evaluate(() => Reflect.get(window, 'nativeLayoutLanguage')('ko'))
    const plan = page.getByRole('textbox', { name: '공급 문서 초안', exact: true })
    await plan.fill('바뀐 문서 초안'); await plan.evaluate(element => Reflect.set(window, 'nativeLayoutPlan', element))
    const open = workspace(page).locator('[role="tabpanel"]:visible .ra-entry button')
    await open.click(); await expect(page.locator('[data-analysis-slot]')).toBeVisible()
    const analysisInput = page.getByRole('textbox', { name: '분석 슬롯 초안', exact: true })
    await analysisInput.fill('분석 초안 변경'); await analysisInput.evaluate(element => Reflect.set(window, 'nativeLayoutAnalysis', element))
    await workspace(page).getByRole('button', { name: '문서로 돌아가기', exact: true }).click()
    await expect(open).toBeFocused(); await expect(plan).toHaveValue('바뀐 문서 초안')
    expect(await plan.evaluate(element => element === Reflect.get(window, 'nativeLayoutPlan'))).toBe(true)
    await expect(input(page)).toHaveValue(initialDraft)
    expect(await input(page).evaluate(element => {
      const field = element as HTMLTextAreaElement
      return [field === Reflect.get(window, 'nativeLayoutInput'), field.selectionStart, field.selectionEnd]
    })).toEqual([true, 3, 12])
    await open.click(); await expect(analysisInput).toHaveValue('분석 초안 변경')
    expect(await analysisInput.evaluate(element => element === Reflect.get(window, 'nativeLayoutAnalysis'))).toBe(true)
    await workspace(page).getByRole('button', { name: '문서로 돌아가기', exact: true }).click()
    // 실제 visible=false와 외부 hidden을 같이 공급한다. 숨긴 observer/폰트 callback은 focus 권한이 없다.
    await page.evaluate(() => {
      Reflect.get(window, 'nativeLayoutVisibility')(false)
      document.getElementById('native-layout-outside')!.focus()
    })
    await expect(workspace(page)).toBeHidden()
    await page.evaluate(() => {
      Reflect.get(window, 'nativeLayoutWidth')(720)
      Reflect.get(window, 'nativeLayoutLanguage')('en')
      Reflect.get(window, 'nativeLayoutTitle')('숨긴 동안 공급된 새 제목')
      Reflect.get(window, 'nativeLayoutView')({ activeDocumentId: 'report', openDocumentIds: ['plan', 'report', 'activity'] })
    })
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(page.locator('#native-layout-outside')).toBeFocused()
    await page.evaluate(() => Reflect.get(window, 'nativeLayoutVisibility')(true))
    await expect(workspace(page)).toBeVisible()
    await expect(page.locator('#native-layout-outside')).toBeFocused()
    await expect(input(page)).toHaveValue(initialDraft)
    expect(await input(page).evaluate(element => element === Reflect.get(window, 'nativeLayoutInput'))).toBe(true)
    expect(await page.evaluate(() => Reflect.get(window, 'nativeLayoutCalls'))).toEqual([])
    expect(audit).toEqual({ errors: [], blocked: [] })
  })
}
