import { criticParagraphs, type ResearchCriticReview } from '../research-view-model'
import '../client-research-document.css'
import { clientResearchLabel } from '../client-research-label'
import { useClientPreferences } from '../client-preferences'
import { researchDocumentCopy } from '../internal-poc/native-research-document-copy'
import { nativeResearchText } from '../internal-poc/native-research-workspace-copy'

export function ClientCriticReview({ review, source = 'service' }: { review: ResearchCriticReview; source?: 'service' | 'mock' }) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof researchDocumentCopy>[0]) => researchDocumentCopy(key, language)
  const label = clientResearchLabel('Critic Review', language)
  const paragraphs = criticParagraphs(review, language, source)
  return <section className="g-adoc research-critic-document" aria-label={nativeResearchText(language, 'document', { label })} data-version={review.version}>
    <h3>{label}</h3><div className="meta">{t('criticFlow')}</div>
    <div className="research-critic-blocks">
      <div><span className="g-tag">{t('builderRole')}</span><p>{paragraphs.builder}</p></div>
      <div><span className="g-tag warn">{t('criticRole')}</span><p>{paragraphs.critic}</p></div>
      <div><span className="g-tag ok">{t('verdictRole')}</span><p>{paragraphs.verdict}</p></div>
    </div>
  </section>
}
