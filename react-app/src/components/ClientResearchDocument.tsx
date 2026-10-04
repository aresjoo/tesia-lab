import { criticParagraphs, type ResearchCriticReview } from '../research-view-model'
import '../client-research-document.css'
import { clientResearchLabel } from '../client-research-label'
import { useClientPreferences } from '../client-preferences'

export function ClientCriticReview({ review }: { review: ResearchCriticReview }) {
  const { language } = useClientPreferences()
  const label = clientResearchLabel('Critic Review', language)
  const paragraphs = criticParagraphs(review)
  return <section className="g-adoc research-critic-document" aria-label={`${label} 문서`} data-version={review.version}>
    <h3>{label}</h3><div className="meta">Builder 주장 → Critic 반박 → 데이터</div>
    <div className="research-critic-blocks">
      <div><span className="g-tag">Builder</span><p>{paragraphs.builder}</p></div>
      <div><span className="g-tag warn">Critic</span><p>{paragraphs.critic}</p></div>
      <div><span className="g-tag ok">Verdict</span><p>{paragraphs.verdict}</p></div>
    </div>
  </section>
}
