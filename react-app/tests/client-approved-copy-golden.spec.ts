import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import type GoldenFixture from './fixtures/approved-client-copy.json'

const golden = JSON.parse(readFileSync(new URL('./fixtures/approved-client-copy.json', import.meta.url), 'utf8')) as typeof GoldenFixture

// 원9fb AST literal로 만든 독립 골든이다. 제품 사전을 기대값으로 생성하지 않는다.
// Node 정적 비교만 수행하며 page/API/시계·실인증·가격/서비스 승인을 검증하지 않는다.
const dictionary = JSON.parse(readFileSync(new URL('../src/client-reference-copy.json', import.meta.url), 'utf8')) as {
  I18N: Record<string, Record<string, string>>
  PH_ROT: unknown
  GLC_LANGS: unknown
  GLC_CURS: unknown
}

function koreanScheduleLiteral(key = 'noSchedule') {
  const source = ts.createSourceFile('client-research-copy.ts',
    readFileSync(new URL('../src/client-research-copy.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const values: string[] = []
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'ko'
      && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      for (const property of node.initializer.properties) {
        if (ts.isPropertyAssignment(property)
          && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
          && property.name.text === key && ts.isStringLiteral(property.initializer)) {
          values.push(property.initializer.text)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  expect(values).toHaveLength(1)
  return values[0]
}

test('독립 승인 카피 골든은 원9fb의 24개 사전 literal과 예약 빈 문구를 고정한다', () => {
  expect(golden.provenance.originalCommit).toBe('9fbff821df62cad11d026022fc7628c7fcebc431')
  expect(golden.provenance.sha256).toBe('f2475453a03b2646361546ac32002b00e4ce26ee014abf79d3be6262b318e321')
  expect(golden.restored).toHaveLength(24)
  expect(new Set(golden.restored.map(row => row.key + ':' + row.locale)).size).toBe(24)
  expect(golden.schedule.originalLine).toBe(12172)
})

for (const row of golden.restored) {
  test(`승인 원문 ${row.key} ${row.locale} literal을 정확히 보존한다`, () => {
    expect(dictionary.I18N[row.key]?.[row.locale]).toBe(row.value)
  })
}

test('승인 원문 noSchedule ko 예약 빈 문구를 정확히 보존한다', () => {
  expect(koreanScheduleLiteral()).toBe(golden.schedule.value)
})

test('연구 검색 빈 문구와 최종 원본 override의 검색·빈기록·더보기 문구를 보존한다', () => {
  expect(golden.history.sourceFunction).toBe('gHistList')
  expect(golden.history.initialLine).toBe(12126)
  expect(golden.history.finalOverrideLines).toEqual([24695, 24696])
  expect(Object.keys(golden.history.values).sort()).toEqual(['more', 'noHistory', 'noResults', 'search'])
  for (const [key, value] of Object.entries(golden.history.values)) {
    expect(koreanScheduleLiteral(key)).toBe(value)
  }
})

test('이미 복원된 한국어 무료 안내와 Google·Apple·이메일의 일곱 언어 labels를 보존한다', () => {
  expect(dictionary.I18N['auth.free'].ko).toBe(golden.preserved.I18N['auth.free'].ko)
  for (const key of ['auth.free', 'auth.title', 'auth.google', 'auth.apple', 'auth.email', 'auth.continue'] as const) {
    expect(dictionary.I18N[key]).toEqual(golden.preserved.I18N[key])
  }
})

test('승인 HTML 줄바꿈·이메일 보간·문장 안 로그인 마커를 일곱 언어에서 보존한다', () => {
  for (const key of ['code.sub.login', 'code.sub.signup', 'pw.sub', 'side.note'] as const) {
    expect(dictionary.I18N[key]).toEqual(golden.preserved.I18N[key])
    for (const value of Object.values(dictionary.I18N[key])) {
      if (key === 'side.note') expect(value.match(/\|/g)).toHaveLength(2)
      else {
        expect(value.match(/<br>/g)).toHaveLength(1)
        expect(value.match(/\{e\}/g)).toHaveLength(1)
      }
    }
  }
})

test('원본 PH_ROT의 일곱 언어 문구·공백·순서를 보존한다', () => {
  expect(dictionary.PH_ROT).toEqual(golden.preserved.PH_ROT)
})

test('원본 언어·통화 메타데이터와 적용 안내의 값·기호·순서를 보존한다', () => {
  // GLC_CURS는 원본 보존 메타데이터다. 현재 통화 선택이나 실제 환율을 활성화하지 않는다.
  expect(dictionary.GLC_LANGS).toEqual(golden.preserved.GLC_LANGS)
  expect(dictionary.GLC_CURS).toEqual(golden.preserved.GLC_CURS)
  for (const key of ['glc.lang', 'glc.curTab', 'glc.cur', 'glc.info'] as const) {
    expect(dictionary.I18N[key]).toEqual(golden.preserved.I18N[key])
  }
})
