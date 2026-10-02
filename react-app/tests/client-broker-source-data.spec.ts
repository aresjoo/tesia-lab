import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { BROKER_INFO, BROKER_SOURCE_COMMIT, CLIENT_BROKERS, brokerReviews, filterBrokers } from '../src/client-broker-fixtures'

// Golden hashes were calculated from local git show 621cbed:index.html after
// its TF_BK_INFO merge, and from the original asset blobs. They pin a source UI
// snapshot, NOT current fees, account availability or trading authorization.
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const ids = ['binance', 'okx', 'bybit', 'bitget', 'mexc', 'woox', 'upbit', 'coinbase', 'kis', 'robinhood', 'ibkr', 'schwab', 'fidelity', 'etrade', 'webull', 'etoro', 'saxo', 'ig', 'moomoo', 'tiger', 'kiwoom']
const broker = (id: string) => {
  const value = CLIENT_BROKERS.find(item => item.id === id)
  if (!value) throw new Error(`Missing source broker: ${id}`)
  return value
}

test('621cbed 실행 후 사업자·상세 객체 전체가 고정 원본 Golden과 일치한다', () => {
  expect(BROKER_SOURCE_COMMIT).toBe('621cbedcdd6b8f30b9b678763d8ed0bf2767e8bb')
  expect(hash(JSON.stringify(CLIENT_BROKERS))).toBe('be8bd9bfa8d7ed5ce73711f25cbe7b43d244ab4a580b133d5af5321cf3512cec')
  expect(hash(JSON.stringify(BROKER_INFO))).toBe('26aeec0a1c97137192f88a0aa83ab80cf986ed9737dbff14166faa33f2f54cf7')
  expect(CLIENT_BROKERS.map(item => item.id)).toEqual(ids)
  expect(CLIENT_BROKERS.map(item => item.ord)).toEqual(ids.map((_, index) => index + 1))
})

test('21종 기본 순서와 8·5·8 유형 및 6·15 표시 필터를 보존한다', () => {
  expect(filterBrokers('all', 'order').map(item => item.id)).toEqual(ids)
  expect(filterBrokers('conn', 'order').map(item => item.id)).toEqual(ids.slice(0, 6))
  expect(filterBrokers('soon', 'order')).toHaveLength(15)
  expect(filterBrokers('ex', 'order')).toHaveLength(8)
  expect(filterBrokers('stock', 'order')).toHaveLength(5)
  expect(filterBrokers('broker', 'order')).toHaveLength(8)
})

test('현물·선물 요율 문자열과 미확인 null을 원본 표기 그대로 보존한다', () => {
  const expected = [
    ['binance', '0.10%', '0.10%', '0.02%', '0.05%', '최대 150x'],
    ['okx', '0.10%', '0.20%', '0.02%', '0.05%', '최대 100x'],
    ['bybit', '0.10%', '0.10%', '0.02%', '0.055%', '최대 150x'],
    ['bitget', '0.10%', '0.10%', '0.02%', '0.06%', '최대 125x'],
    ['mexc', '0.0000%', '0.0500%', '0.000%', '0.020%', '최대 500x'],
    ['woox', '0.08%', '0.10%', '0.00%', null, '최대 100x'],
  ] as const
  for (const [id, mk, tk, fmk, ftk, fut] of expected) {
    const row = broker(id)
    expect(row.fees).toEqual({ dep: '없음 (암호화폐 입금)', wd: '네트워크 수수료', ina: '없음', mk, tk, fmk, ftk })
    expect(row.lev2).toEqual({ spot: '1:1', fut })
    expect(row.asof).toBe('2026.09')
    expect(row.lev).toBeUndefined()
    expect(row).not.toHaveProperty('promoSub')
  }
  expect(broker('okx').feeNote).toContain('싱가포르 일반 등급')
  expect(broker('mexc').feeNote).toContain('API 주문은 별도 요율')
  expect(broker('woox').feeNote).toContain('공식 공개 표가 없어 미표기')
})

test('공개 평점 출처와 미정 평점은 리뷰 평균이나 0으로 바꾸지 않는다', () => {
  expect(ids.slice(0, 6).map(id => broker(id).rating)).toEqual([4.7, 4.6, 4.7, 4.6, 4.7, null])
  expect(broker('binance').ratingSrc).toBe('App Store 영국 기준, 약 12만 개 평가')
  expect(broker('okx').ratingSrc).toBe('App Store 미국 기준, 약 2.3만 개 평가')
  expect(broker('bybit').ratingSrc).toBe('App Store 미국 기준')
  expect(broker('bitget').ratingSrc).toBe('App Store 미국 기준, 약 5.5천 개 평가')
  expect(broker('mexc').ratingSrc).toBe('App Store 미국 기준, 약 8.3천 개 평가')
  expect(broker('woox').ratingSrc).toBeNull()
  expect(CLIENT_BROKERS.filter(item => !item.conn).every(item => item.rating === null)).toBe(true)
})

test('Bybit 사용자 통계와 Upbit 자산의 원본 병합 결과를 임의 교정하지 않는다', () => {
  expect(broker('bybit')).toMatchObject({ conn: true, traders: '410', traderN: 0, rvN: 18 })
  expect(broker('upbit').assetsList).toEqual(['암호화폐 현물 (원화 마켓)'])
  expect(BROKER_INFO.upbit.hq).toBe('서울 (두나무)')
  expect(BROKER_INFO.woox).toMatchObject({ founded: '2021 (플랫폼 출시)', hq: 'WOOTECH Limited Corp. 운영 (공식 약관 기준)' })
})

test('부분 상세정보와 unknown 기능은 가짜 문서·FAQ·미정 리뷰로 채우지 않는다', () => {
  for (const id of ['bitget', 'mexc']) {
    expect(BROKER_INFO[id].docsUrl).toBeUndefined()
    expect(BROKER_INFO[id].about).toBeUndefined()
    expect(BROKER_INFO[id].faq).toBeUndefined()
    expect(BROKER_INFO[id].caps).toEqual({ marketOrder: true, limitOrder: true, stopOrder: true, stopLimitOrder: 'unknown', trailingStop: 'unknown', oco: 'unknown', postOnly: 'unknown', reduceOnly: 'unknown', demoAccount: 'unknown', publicApi: true, level2: true })
  }
  const unknownCount = CLIENT_BROKERS.filter(item => item.rvN === undefined)
  expect(unknownCount.map(item => item.id)).toEqual(ids.slice(7, 20))
  for (const item of unknownCount) {
    expect(item.conn).toBe(false)
    expect(item.traderN).toBeUndefined()
    expect(item.fees).toBeUndefined()
    expect(Object.keys(BROKER_INFO[item.id]).sort()).toEqual(['founded', 'hq'])
    expect(brokerReviews(item)).toEqual([])
  }
})

test('기존 6종과 신규 2종의 명시된 데모 리뷰만 원본 개수·내용으로 보존한다', () => {
  const expected: Record<string, [number, string]> = {
    binance: [44, 'a7d74ab0538b28a596b495ac76deddb3d4e930754b7b74b8195879273904d3d6'],
    okx: [37, '4349188657de227235d13f7a5db24b6a5c4546651ef1ffb8c6f6da12ce58a01c'],
    bybit: [18, '7f4240914c84af94b9ad42cb980254cfc39bd0e745aee1261a44af0c1234ec4b'],
    bitget: [21, 'ed8b5b49711a0230e27eb6a3ee8d806fe473ac4605e4471dd9d851d6802a9fcb'],
    mexc: [17, '7def9ea37a5242e30b172db199892c2231f72b15a6bd3968611e4769f86757c7'],
    woox: [23, '5bbfdbf48007001f6e555b2f9796711f10eb7dcf351c9dad1ea735dffa7d6e50'],
    upbit: [29, '4da34b92a3bc10414d6d2335c08f277ed5aed031abc6331fc5a8825de2356565'],
    kiwoom: [12, '80350772fdcc52dcb1e7f984ec35ea3242d6e3164720c02a65d8e54a49f4391a'],
  }
  for (const [id, [count, golden]] of Object.entries(expected)) {
    const reviews = brokerReviews(broker(id))
    expect(reviews).toHaveLength(count)
    expect(hash(JSON.stringify(reviews))).toBe(golden)
  }
})

test('미정값을 안전하게 정렬하되 원본 객체·기본 순서를 변경하지 않는다', () => {
  const before = JSON.stringify(CLIENT_BROKERS)
  expect(filterBrokers('all', 'rating').slice(0, 5).map(item => item.id)).toEqual(['binance', 'bybit', 'mexc', 'okx', 'bitget'])
  expect(filterBrokers('all', 'reviews').slice(0, 8).map(item => item.id)).toEqual(['binance', 'okx', 'upbit', 'woox', 'bitget', 'bybit', 'mexc', 'kiwoom'])
  expect(filterBrokers('all', 'users').slice(0, 6).map(item => item.id)).toEqual(['binance', 'okx', 'bitget', 'mexc', 'woox', 'bybit'])
  expect(filterBrokers('all', 'unknown-sort').map(item => item.id)).toEqual(ids)
  expect(JSON.stringify(CLIENT_BROKERS)).toBe(before)
})

test('신규 15개 앱 아이콘은 621cbed 원본 blob SHA-256과 일치한다', () => {
  const assets: Record<string, string> = {
    bitget: '528e66ade44e8fbf37a32a5b23895624113210a43d709fe45cef1161c5f46b81',
    mexc: '26241b677bcd8aad0121915681e7d82df2567b70a56c75b21c9a68e6b6ab6bdd',
    coinbase: '303c0222ab1719922e68294215793a24cf21e664c4da09b0ca6447b945a0d603',
    kis: 'cd813b8e1e21ae07d966ea50e8d8fec6fd41b383b9b8ad0ffaf38b2da4168183',
    robinhood: '63b80afc92b5eedfa5f1ecfa97321e93749f3e044eeda795e0216d8ab2c603fc',
    ibkr: 'a5839b4053d565ec1f9a5dc40a928e27428df572f862617e38d22f5c954bea80',
    schwab: '3fc279cc7ef55e7c6ce17aecf103be5b8d288e619c15b87daa66ab11ee5422d3',
    fidelity: 'f46f4d979fc00dc2045fc62b7e4666feb79f68920fe29afc095cee7f6a9d1698',
    etrade: 'b3d09b81cf4a8e5acfdb5ec9bdaf52a6ed61aeb6d634b176188fc6b3a2db7141',
    webull: '16195a3356dc70af783f4ed56865bc188cd28cb40ab7564eb26e164924988734',
    etoro: 'a1307c0b9cb3dabf8250abf88ea913c4a6eb3f322e0c3895aab306221b077f6a',
    saxo: '191d9435414fd0b2ea17366375ae5f3b3b2b158a165a48b1928afec171ffcd0d',
    ig: 'adf8548c6a38264a86ad706b60f596b1395fe0e9fcda2ee92aca1f03dc7826c8',
    moomoo: 'af6e07be793edb72ccf7b9d1c9af83eaa0b7a9fdfef7e788173906d6b5332db8',
    tiger: '728d9883049ea2c1609d674568db379aad6d872658d1704a793b8c8a115db95d',
  }
  expect(Object.keys(assets)).toHaveLength(15)
  for (const [id, golden] of Object.entries(assets)) expect(hash(readFileSync(`public/client-broker-assets/app-${id}.png`))).toBe(golden)
  for (const item of CLIENT_BROKERS) expect(readFileSync(`public/client-broker-assets/app-${item.id}.png`).length).toBeGreaterThan(0)
})
