import {
  adaptRecordedBacktestFixture,
  BacktestReportAdapterError,
} from './backtest-report.adapter'
import type {
  BacktestReportViewState,
  ExecutiveBacktestReport,
  RecordedBacktestFixture,
} from './backtest-report.types'

const ALLOWED_DEMO_STATES = new Set(['loading', 'empty', 'error', 'invalid'])

export class MockReportBoundaryError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'MockReportBoundaryError'
  }
}

export function adaptPublicRecordedFixture(
  fixture: RecordedBacktestFixture,
): ExecutiveBacktestReport {
  if (
    fixture.provenance.source !== 'RECORDED_FIXTURE'
    || fixture.provenance.sourceLabel !== '시연 전용 · MOCK FIXTURE'
  ) {
    throw new MockReportBoundaryError('REPORT_PUBLIC_BOUNDARY_VIOLATION')
  }
  return adaptRecordedBacktestFixture(fixture)
}

function requestedDemoState(search: string) {
  const params = new URLSearchParams(search)
  const entries = [...params.entries()]
  const stateValues = params.getAll('state')
  if (entries.some(([key]) => key !== 'state') || stateValues.length > 1) {
    throw new MockReportBoundaryError('REPORT_URL_INPUT_REJECTED')
  }
  const requestedState = stateValues[0]
  if (params.has('state') && !requestedState) {
    throw new MockReportBoundaryError('REPORT_URL_INPUT_REJECTED')
  }
  if (requestedState && !ALLOWED_DEMO_STATES.has(requestedState)) {
    throw new MockReportBoundaryError('REPORT_URL_INPUT_REJECTED')
  }
  return requestedState
}

export function createMockReportState(
  fixture: RecordedBacktestFixture,
  search = '',
): BacktestReportViewState {
  let requestedState: string | undefined
  try {
    requestedState = requestedDemoState(search)
  } catch {
    return { status: 'ERROR', message: '허용되지 않은 보고서 입력을 안전하게 차단했습니다.' }
  }

  if (requestedState === 'loading') return { status: 'LOADING' }
  if (requestedState === 'empty') return { status: 'EMPTY' }
  if (requestedState === 'error') {
    return { status: 'ERROR', message: '시연 화면을 불러오는 중 오류가 발생했습니다.' }
  }
  if (requestedState === 'invalid') {
    return { status: 'INVALID', message: '시연용 artifact가 표시 계약을 충족하지 못했습니다.' }
  }

  try {
    return { status: 'READY', report: adaptPublicRecordedFixture(fixture) }
  } catch (error) {
    if (error instanceof BacktestReportAdapterError || error instanceof MockReportBoundaryError) {
      return { status: 'INVALID', message: '시연용 artifact가 표시 계약을 충족하지 못했습니다.' }
    }
    return { status: 'ERROR', message: '시연 화면을 불러오는 중 오류가 발생했습니다.' }
  }
}
