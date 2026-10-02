import { expect, test } from '@playwright/test'
import { catalogueSourceSha } from '../src/client-catalogue'
import { catalogueBacktestLocation, readSharedLocation, sharedHash } from '../src/client-shared-navigation'
import { readCataloguePlanIntent } from '../src/client-catalogue-plan'

test('카탈로그 직접검증 주소는 상세·copy·mine 경로와 섞이지 않는다', () => {
  const location = catalogueBacktestLocation('f1')
  expect(location).toEqual({ view: 'catalogue-backtest', nick: 'f1', period: 'all' })
  expect(sharedHash(location)).toBe('#/share/bt/f1')
  expect(readSharedLocation('#/share/bt/f1')).toEqual(location)
  expect(readSharedLocation('#/share/bt/mine')).toBeNull()
  expect(readSharedLocation('#/share/s/f1')).toEqual({ nick: 'f1', period: 'all' })
  expect(readSharedLocation('#/share/copy/f1')).toMatchObject({ view: 'copy-setup', nick: 'f1' })
})

test('연결 요청 복귀는 직접검증의 동일owner·원산지·전략에만 결속한다', () => {
  const value = { owner: 'one', sourceSha: catalogueSourceSha, id: 'f1', returnHash: '#/share/bt/f1' }
  expect(readCataloguePlanIntent(value, 'one')).toEqual(value)
  for (const next of [{ ...value, owner: 'two' }, { ...value, sourceSha: 'old' }, { ...value, returnHash: '#/share/bt/f2' }, { ...value, returnHash: '#/share/bt/mine' }, { ...value, returnHash: '#/share/copy/f1' }]) {
    expect(readCataloguePlanIntent(next, 'one')).toBeNull()
  }
  expect(readCataloguePlanIntent(value, null)).toBeNull()
})
