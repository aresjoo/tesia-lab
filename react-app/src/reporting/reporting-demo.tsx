import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist/wght.css'
import { RECORDED_BACKTEST_REPORT_FIXTURE } from './backtest-report.fixture'
import { BacktestExecutiveReport } from './BacktestExecutiveReport'
import { createMockReportState } from './mock-report-boundary'
import './backtest-executive-report.css'

const root = document.getElementById('reporting-root')
if (!root) throw new Error('reporting-root is required')

createRoot(root).render(
  <StrictMode>
    <BacktestExecutiveReport
      state={createMockReportState(RECORDED_BACKTEST_REPORT_FIXTURE, window.location.search)}
    />
  </StrictMode>,
)
