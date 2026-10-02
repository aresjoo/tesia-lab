import { expect, test } from '@playwright/test'
import type { ClientTurn } from '../src/client-experience-store'
import { canAdmitMockConditionalOrderTurn, canDisplayLegacyConditionalOrderTurn } from '../src/client-conditional-order-turn-binding'

const owner = 'owner-a'
const answer = '조건을 확인했습니다.\n[ORDER {"asset":"BTC","side":"sell","trigger":90000}]'
const turn = (patch: Partial<ClientTurn> = {}): ClientTurn => ({
  id: 'turn-a', question: '조건 확인', answer, fullAnswer: answer,
  startedAt: 1000, finishedAt: 1100, status: 'done', suggestions: [], phase: 'plan', ...patch,
})
// Only owner fields participate here; their full display-schema validation is
// owned by the existing common-context decoder, not this admission predicate.
const revision = (value: string | null) => ({ owner: value }) as NonNullable<ClientTurn['commonRevision']>
const context = (value: string | null) => ({ owner: value }) as NonNullable<ClientTurn['commonResultContext']>

const cases: { name: string; patch: Partial<ClientTurn>; owner?: string | null; admit: boolean; legacy: boolean }[] = [
  { name: '완료된 현재 owner', patch: { conditionalOrderOwner: owner }, admit: true, legacy: false },
  { name: '명시 null guest', owner: null, patch: { conditionalOrderOwner: null }, admit: true, legacy: false },
  { name: 'marker 없는 완료 legacy', patch: {}, admit: false, legacy: true },
  { name: 'marker 없는 guest legacy', owner: null, patch: {}, admit: false, legacy: true },
  { name: '명시 foreign owner', patch: { conditionalOrderOwner: 'owner-b' }, admit: false, legacy: false },
  { name: 'guest marker와 현재 owner 불일치', patch: { conditionalOrderOwner: null }, admit: false, legacy: false },
  { name: 'signed marker와 guest 불일치', owner: null, patch: { conditionalOrderOwner: owner }, admit: false, legacy: false },
  { name: '명시 undefined marker는 legacy가 아님', patch: { conditionalOrderOwner: undefined }, admit: false, legacy: false },
  { name: '일치하는 common owner', patch: { conditionalOrderOwner: owner, commonRevision: revision(owner), commonResultContext: context(owner) }, admit: true, legacy: false },
  { name: '일치하는 common guest', owner: null, patch: { conditionalOrderOwner: null, commonRevision: revision(null), commonResultContext: context(null) }, admit: true, legacy: false },
  { name: '일치하는 common legacy', patch: { commonRevision: revision(owner), commonResultContext: context(owner) }, admit: false, legacy: true },
  { name: '다른 common revision owner', patch: { conditionalOrderOwner: owner, commonRevision: revision('owner-b') }, admit: false, legacy: false },
  { name: '다른 common result owner', patch: { conditionalOrderOwner: owner, commonResultContext: context('owner-b') }, admit: false, legacy: false },
  { name: 'legacy 다른 common owner', patch: { commonResultContext: context('owner-b') }, admit: false, legacy: false },
]
for (const item of cases) test(item.name, () => {
  const input = turn(item.patch), currentOwner = item.owner === undefined ? owner : item.owner
  expect(canAdmitMockConditionalOrderTurn(input, currentOwner)).toBe(item.admit)
  expect(canDisplayLegacyConditionalOrderTurn(input, currentOwner)).toBe(item.legacy)
  expect(input.answer).toBe(answer)
})

const excluded: { name: string; patch: Partial<ClientTurn> }[] = [
  { name: 'stopped', patch: { status: 'stopped' } },
  { name: 'running', patch: { status: 'running' } },
  { name: 'failed', patch: { status: 'failed' } },
  { name: 'service sequence', patch: { responseSequence: { owner } as NonNullable<ClientTurn['responseSequence']> } },
  { name: 'sequenceInvalid', patch: { responseSequenceInvalid: true } },
  { name: 'market observed', patch: { marketResponse: { owner } as NonNullable<ClientTurn['marketResponse']> } },
  { name: 'sourceIntake', patch: { sourceIntake: {} as NonNullable<ClientTurn['sourceIntake']> } },
  { name: 'sourceIntakeInvalid', patch: { sourceIntakeInvalid: true } },
  { name: 'commonRevisionInvalid', patch: { commonRevisionInvalid: true } },
  { name: 'commonResultContextInvalid', patch: { commonResultContextInvalid: true } },
]
for (const item of excluded) test(`${item.name}은 marker 유무와 무관하게 원문을 보존한다`, () => {
  for (const marker of [{ conditionalOrderOwner: owner }, {}]) {
    const input = Object.freeze(turn({ ...item.patch, ...marker }))
    expect(canAdmitMockConditionalOrderTurn(input, owner)).toBe(false)
    expect(canDisplayLegacyConditionalOrderTurn(input, owner)).toBe(false)
    expect(input.answer).toBe(answer); expect(input.fullAnswer).toBe(answer)
  }
})

test('상속된 owner marker는 명시 admission이 아니며 predicate는 metadata를 변경하지 않는다', () => {
  const input = Object.freeze(Object.assign(Object.create({ conditionalOrderOwner: owner }), turn())) as ClientTurn
  const keys = Reflect.ownKeys(input)
  expect(canAdmitMockConditionalOrderTurn(input, owner)).toBe(false)
  expect(canDisplayLegacyConditionalOrderTurn(input, owner)).toBe(true)
  expect(Reflect.ownKeys(input)).toEqual(keys)
  expect(Object.hasOwn(input, 'conditionalOrderOwner')).toBe(false)
  expect(input.answer).toBe(answer)
})
