import { createRoot } from 'react-dom/client'
import { ClientResearchActivity } from '../../src/components/ClientResearchActivity'

/** Supplied compatibility display only; offline source ASK has no observed task timestamps. */
export function mountObservedActivity() {
  const host = document.createElement('div')
  host.className = 'client-lab-conversation'
  document.body.append(host)
  createRoot(host).render(<ClientResearchActivity label="명시적인 관측 활동" status="done" startedAt={1000} finishedAt={3000}
    steps={[{ id: 'observed', title: '관측된 작업', status: 'done' }]} source="mock" />)
}
