// Compiled from tesia-lab 9fbff821 policies/index.html. No source scripts run here.
import { useEffect, useRef, type MouseEventHandler, type ReactNode } from 'react'
import { InternalLink } from './InternalLink'
import type { PolicyLabels } from '../client-policy-copy'
import { useClientPreferences } from '../client-preferences'
import policyContent from '../client-policy-content-copy.json'

export function ClientPolicyPage({ policyTab, activeSection, labels, onHelp, previewNotice }: {
  policyTab: string; activeSection: string; labels: PolicyLabels;
  onHelp: MouseEventHandler<HTMLButtonElement>; previewNotice: ReactNode
}) {
  const { language } = useClientPreferences()
  const t = (original: string): string => {
    if (language === 'ko') return original
    const translated = (policyContent as Record<string, Record<string, string>>)[original]?.[language]
    if (!translated) throw new Error('INCOMPLETE_POLICY_LOCALE')
    return translated
  }
  const header = useRef<HTMLElement>(null)
  useEffect(() => {
    const element = header.current
    const root = element?.closest<HTMLElement>('.client-info-policies')
    if (!element || !root) return
    const update = () => root.style.setProperty('--policy-header-height', `${element.getBoundingClientRect().height}px`)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => { observer.disconnect(); root.style.removeProperty('--policy-header-height') }
  }, [])
  return <>
<header className="hd" ref={header}>
<InternalLink className="brand" href="/" style={{"color":"#00f0ff"}}>
<img src="/teth-logo-f260167.png" alt="" style={{"width":"22px","height":"auto"}} />{"TETH"}
</InternalLink>
<nav>
<InternalLink href="/about/">
{labels.about}
</InternalLink>
<InternalLink href="/download/">
{labels.download}
</InternalLink>

</nav>
<span className="sp">

</span>
<InternalLink className="cta" href="/">
{labels.start}
</InternalLink>

</header>
<main id="site-main" tabIndex={-1}>
<div className="pg-top">
<span className="pg-lb">
{"TETH"}
</span>
<h1 className="pg-h1">
{labels.title}
</h1>
<nav className="tabs" id="tabs">
<InternalLink href="/policies/#overview" data-v="overview" className={policyTab === "overview" ? 'on' : ''} aria-current={policyTab === "overview" ? 'page' : undefined}>
{labels.overview}
</InternalLink>
<InternalLink href="/policies/#privacy" data-v="privacy" className={policyTab === "privacy" ? 'on' : ''} aria-current={policyTab === "privacy" ? 'page' : undefined}>
{labels.privacy}
</InternalLink>
<InternalLink href="/policies/#terms" data-v="terms" className={policyTab === "terms" ? 'on' : ''} aria-current={policyTab === "terms" ? 'page' : undefined}>
{labels.terms}
</InternalLink>
<InternalLink href="/policies/#technologies" data-v="technologies" className={policyTab === "technologies" ? 'on' : ''} aria-current={policyTab === "technologies" ? 'page' : undefined}>
{labels.technologies}
</InternalLink>
<InternalLink href="/policies/#faq" data-v="faq" className={policyTab === "faq" ? 'on' : ''} aria-current={policyTab === "faq" ? 'page' : undefined}>
{labels.faq}
</InternalLink>

</nav>

{previewNotice}
</div>
<section id="v-overview" lang={language} className={policyTab === "overview" ? 'view on' : 'view'}>
<div className="ov">
<div className="cell">
<h2>
{t("개인정보처리방침")}
</h2>
<p>
{t("TETH가 수집하는 정보, 수집 이유, 정보 사용 방법, 정보 검토 및 업데이트 방법에 대해 설명합니다.")}
</p>
<div className="lnk-row">
<InternalLink className="lnk" href="/policies/#privacy">
{t("TETH 개인정보처리방침 읽기")}
</InternalLink>

</div>

</div>
<div className="cell">
<h2>
{t("서비스 약관")}
</h2>
<p>
{t("TETH 서비스를 이용할 때 사용자가 동의하는 규정을 설명합니다.")}
</p>
<div className="lnk-row">
<InternalLink className="lnk" href="/policies/#terms">
{t("TETH 서비스 약관 읽기")}
</InternalLink>

</div>

</div>
<div className="cell">
<h2>
{t("TETH 안전 센터")}
</h2>
<div className="ico-row">
<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 2l9 5v6c0 5-4 8-9 9-5-1-9-4-9-9V7z">

</path>
<path d="M8.5 12l2.5 2.5 4.5-4.5">

</path>

</svg>
<div>
<p style={{"marginTop":"0"}}>
{t("모두를 위한 제품을 만든다는 것은 제품을 사용하는 모든 사람을 보호한다는 의미입니다. 거래소 API 키 암호화, 출금 권한 미요청, 1회 손실 한도 등 TETH에 내장된 보안 기능과 개인정보 보호 설정, 도구에 관해 자세히 알아봅니다.")}
</p>
<div className="lnk-row">
<InternalLink className="lnk" href="/policies/#technologies">
{t("보안을 위한 TETH의 노력 알아보기")}
</InternalLink>

</div>

</div>

</div>

</div>
<div className="cell">
<h2>
{t("TETH 계정")}
</h2>
<div className="ico-row">
<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
<circle cx="12" cy="12" r="9.2">

</circle>
<circle cx="12" cy="9.6" r="3">

</circle>
<path d="M6.4 18.4c1.2-2.6 3.2-3.9 5.6-3.9s4.4 1.3 5.6 3.9">

</path>

</svg>
<div>
<p style={{"marginTop":"0"}}>
{t("계정을 한 곳에서 관리하고 안전하게 보호합니다. TETH 계정에서 데이터와 개인정보, 거래소 연결을 보호하는 데 필요한 설정 및 도구에 쉽게 액세스할 수 있습니다.")}
</p>
<div className="lnk-row">
<InternalLink className="lnk" href="/">
{t("TETH 계정 확인하기")}
</InternalLink>

</div>

</div>

</div>

</div>
<div className="cell">
<h2>
{t("TETH의 개인정보 보호 및 보안 원칙")}
</h2>
<div className="ico-row">
<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
<rect x="4" y="10" width="16" height="10" rx="2">

</rect>
<path d="M8 10V7a4 4 0 0 1 8 0v3">

</path>

</svg>
<div>
<p style={{"marginTop":"0"}}>
{t("TETH는 모두를 지켜 주는 투자 연구 환경을 구축합니다. TETH의 제품, 프로세스, 직원은 다음 원칙을 바탕으로 사용자의 데이터와 자산 접근 권한을 비공개로 안전하게 유지합니다.")}
</p>
<div className="lnk-row">
<InternalLink className="lnk" href="/policies/#privacy">
{t("TETH의 개인정보 보호 및 보안 원칙 살펴보기")}
</InternalLink>

</div>

</div>

</div>

</div>
<div className="cell">
<h2>
{t("TETH 제품 개인정보 보호 가이드")}
</h2>
<div className="ico-row">
<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
<path d="M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14">

</path>
<path d="M4 19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2">

</path>
<path d="M8 8h8M8 12h5">

</path>

</svg>
<div>
<p style={{"marginTop":"0"}}>
{t("전략 연구, 백테스트, 실행 및 모니터링을 사용할 때 개인정보와 사용 기록을 제어하고 보호할 권한은 사용자 자신에게 있습니다. ")}<InternalLink className="lnk" href="/policies/#privacy">
{t("TETH 제품 개인정보 보호 가이드")}
</InternalLink>
{t("를 이용하면 TETH 제품에서 제공하는 개인정보 보호 기능을 관리하는 방법을 알아볼 수 있습니다.")}
</p>

</div>

</div>

</div>

</div>

</section>
<section id="v-privacy" lang={language} className={policyTab === "privacy" ? 'view on' : 'view'}>
<div className="doc">
<nav className="toc" data-toc="">
<InternalLink href="/policies/#p-intro" data-t="p-intro" className={activeSection === "p-intro" ? 'on' : ''} aria-current={activeSection === "p-intro" ? 'location' : undefined}>
{t("소개")}
</InternalLink>
<InternalLink href="/policies/#p-collect" data-t="p-collect" className={activeSection === "p-collect" ? 'on' : ''} aria-current={activeSection === "p-collect" ? 'location' : undefined}>
{t("TETH에서 수집하는 정보")}
</InternalLink>
<InternalLink href="/policies/#p-why" data-t="p-why" className={activeSection === "p-why" ? 'on' : ''} aria-current={activeSection === "p-why" ? 'location' : undefined}>
{t("TETH에서 데이터를 수집하는 이유")}
</InternalLink>
<InternalLink href="/policies/#p-settings" data-t="p-settings" className={activeSection === "p-settings" ? 'on' : ''} aria-current={activeSection === "p-settings" ? 'location' : undefined}>
{t("개인정보 보호 설정")}
</InternalLink>
<InternalLink href="/policies/#p-share" data-t="p-share" className={activeSection === "p-share" ? 'on' : ''} aria-current={activeSection === "p-share" ? 'location' : undefined}>
{t("정보 공유")}
</InternalLink>
<InternalLink href="/policies/#p-secure" data-t="p-secure" className={activeSection === "p-secure" ? 'on' : ''} aria-current={activeSection === "p-secure" ? 'location' : undefined}>
{t("정보 보안 유지")}
</InternalLink>
<InternalLink href="/policies/#p-export" data-t="p-export" className={activeSection === "p-export" ? 'on' : ''} aria-current={activeSection === "p-export" ? 'location' : undefined}>
{t("정보 내보내기 및 삭제")}
</InternalLink>
<InternalLink href="/policies/#p-retain" data-t="p-retain" className={activeSection === "p-retain" ? 'on' : ''} aria-current={activeSection === "p-retain" ? 'location' : undefined}>
{t("정보 유지")}
</InternalLink>
<InternalLink href="/policies/#p-comply" data-t="p-comply" className={activeSection === "p-comply" ? 'on' : ''} aria-current={activeSection === "p-comply" ? 'location' : undefined}>
{t("규정 준수")}
</InternalLink>

</nav>
<div className="docmain">
<div className="inner">
<div className="sum">
<div className="sum-row">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<rect x="4" y="10" width="16" height="10" rx="2">

</rect>
<path d="M8 10V7a4 4 0 0 1 8 0v3">

</path>

</svg>
<div>
<b>
{t("출금 권한은 요청하지 않습니다")}
</b>
<span>
{t("잔고 조회와 주문 권한으로만 거래소에 연결합니다.")}
</span>

</div>

</div>
<div className="sum-row">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1">

</path>

</svg>
<div>
<b>
{t("연결은 언제든 해제합니다")}
</b>
<span>
{t("해제하면 저장된 연결 정보를 바로 파기합니다.")}
</span>

</div>

</div>
<div className="sum-row">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M7 3h7l5 5v13H7z">

</path>
<path d="M14 3v5h5M10 13h6M10 17h6">

</path>

</svg>
<div>
<b>
{t("기록은 직접 관리합니다")}
</b>
<span>
{t("전략, 백테스트, 거래 기록을 언제든 내보내고 삭제합니다.")}
</span>

</div>

</div>
<div className="sum-row">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<circle cx="12" cy="12" r="9">

</circle>
<path d="M5.6 5.6l12.8 12.8">

</path>

</svg>
<div>
<b>
{t("광고 목적으로 판매하지 않습니다")}
</b>
<span>
{t("수집한 정보는 서비스를 제공하는 데만 씁니다.")}
</span>

</div>

</div>

</div>
<div className="label" id="p-intro">
{t("TETH 개인정보처리방침")}
</div>
<p className="intro">
{t("TETH는 사용자들이 신뢰를 바탕으로 정보를 제공한다는 것을 잘 알고 있습니다. TETH는 사용자의 신뢰에 대한 막중한 책임을 인지하며 최선을 다해 개인정보를 보호하고 사용자가 직접 제어할 수 있도록 노력하고 있습니다.")}
</p>
<p>
{t("이 개인정보처리방침은 TETH에서 수집하는 정보의 유형, 정보를 수집하는 이유, 정보를 업데이트, 관리, 내보내기, 삭제하는 방식에 대한 이해를 돕기 위한 것입니다.")}
</p>
<div className="callout">
<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 2l9 5v6c0 5-4 8-9 9-5-1-9-4-9-9V7z">

</path>
<circle cx="12" cy="10" r="2.4">

</circle>
<path d="M8.4 15.6c.9-1.8 2.1-2.6 3.6-2.6s2.7.8 3.6 2.6">

</path>

</svg>
<div>
<b>
{t("연결 권한 진단")}
</b>
{t("\n          거래소 연결 권한을 확인하려고 합니까?\n          ")}<div>
<InternalLink className="lnk" href="/">
{t("연결 권한 확인하기")}
</InternalLink>

</div>

</div>

</div>
<p className="meta">
{t("발효일: 2026년 9월 4일")}
</p>
<div className="hr">

</div>
<h2 id="p-collect">
{t("TETH에서 수집하는 정보")}
</h2>
<p>
{t("TETH는 서비스를 제공하기 위해 필요한 최소한의 정보를 수집합니다.")}
</p>
<ul>
<li>
<b>
{t("계정 정보")}
</b>
{t(", 이메일 주소, 로그인 방식(Google, Apple, 이메일), 프로필 이름.")}
</li>
<li>
<b>
{t("거래소 연결 정보")}
</b>
{t(", 사용자가 직접 등록한 API 키. 키는 암호화되어 저장되며, 조회, 주문 권한만 사용합니다. ")}<b>
{t("출금 권한은 어떤 경우에도 요청하거나 저장하지 않습니다.")}
</b>

</li>
<li>
<b>
{t("이용 기록")}
</b>
{t(", 생성한 전략, 백테스트 결과, 실행, 모니터링 기록. 서비스 제공과 복기 기능을 위해 보관됩니다.")}
</li>
<li>
<b>
{t("기기 및 로그 정보")}
</b>
{t(", 접속 기기 유형, 브라우저, IP 주소, 오류 로그. 보안과 품질 개선에 사용됩니다.")}
</li>

</ul>
<h2 id="p-why">
{t("TETH에서 데이터를 수집하는 이유")}
</h2>
<p>
{t("수집한 정보는 다음 목적에만 사용됩니다: 전략 연구, 검증, 실행 서비스 제공, 계정 보호와 이상 접근 탐지, 서비스 품질 개선, 법적 의무 이행. TETH는 사용자의 데이터를 광고 목적으로 제3자에게 판매하지 않습니다.")}
</p>
<h2 id="p-settings">
{t("개인정보 보호 설정")}
</h2>
<p>
{t("계정 설정에서 프로필 정보 수정, 거래소 연결 해제, 알림 수신 여부를 언제든 변경할 수 있습니다. 거래소 연결을 해제하면 저장된 API 키는 즉시 파기됩니다.")}
</p>
<h2 id="p-share">
{t("정보 공유")}
</h2>
<p>
{t("TETH는 다음 경우를 제외하고 개인정보를 외부에 공유하지 않습니다: 사용자가 직접 동의한 경우, 주문 실행을 위해 연결된 거래소에 요청을 전달하는 경우, 법령에 따라 요구되는 경우.")}
</p>
<h2 id="p-secure">
{t("정보 보안 유지")}
</h2>
<p>
{t("모든 데이터는 전송 구간과 저장 시 암호화됩니다. API 키는 별도의 암호화 저장소에 보관되며 내부 직원도 원문에 접근할 수 없습니다. 비정상적인 접근이 감지되면 자동으로 실행이 일시 정지되고 사용자에게 알립니다.")}
</p>
<h2 id="p-export">
{t("정보 내보내기 및 삭제")}
</h2>
<p>
{t("사용자는 언제든 자신의 전략, 백테스트, 거래 기록을 내보낼 수 있으며, 계정 삭제를 요청하면 법적 보관 의무가 있는 정보를 제외한 모든 데이터가 30일 이내에 파기됩니다.")}
</p>
<h2 id="p-retain">
{t("정보 유지")}
</h2>
<p>
{t("계정이 활성 상태인 동안 서비스 제공에 필요한 정보를 보관합니다. 거래 관련 기록은 관련 법령이 정한 기간 동안 보관될 수 있습니다.")}
</p>
<h2 id="p-comply">
{t("규정 준수")}
</h2>
<p>
{t("TETH는 개인정보 보호 관련 법령을 준수하며, 규제 당국의 적법한 요청에 협력합니다. 방침이 변경되는 경우 시행 전에 공지합니다.")}
</p>

</div>

</div>

</div>

</section>
<section id="v-terms" lang={language} className={policyTab === "terms" ? 'view on' : 'view'}>
<div className="doc">
<nav className="toc" data-toc="">
<InternalLink href="/policies/#t-intro" data-t="t-intro" className={activeSection === "t-intro" ? 'on' : ''} aria-current={activeSection === "t-intro" ? 'location' : undefined}>
{t("소개")}
</InternalLink>
<InternalLink href="/policies/#t-scope" data-t="t-scope" className={activeSection === "t-scope" ? 'on' : ''} aria-current={activeSection === "t-scope" ? 'location' : undefined}>
{t("본 약관에서 다루는 내용")}
</InternalLink>
<InternalLink href="/policies/#t-risk" data-t="t-risk" className={activeSection === "t-risk" ? 'on' : ''} aria-current={activeSection === "t-risk" ? 'location' : undefined}>
{t("투자 위험 고지")}
</InternalLink>
<InternalLink href="/policies/#t-auto" data-t="t-auto" className={activeSection === "t-auto" ? 'on' : ''} aria-current={activeSection === "t-auto" ? 'location' : undefined}>
{t("자동매매와 승인")}
</InternalLink>
<InternalLink href="/policies/#t-use" data-t="t-use" className={activeSection === "t-use" ? 'on' : ''} aria-current={activeSection === "t-use" ? 'location' : undefined}>
{t("TETH 서비스 사용")}
</InternalLink>
<InternalLink href="/policies/#t-about" data-t="t-about" className={activeSection === "t-about" ? 'on' : ''} aria-current={activeSection === "t-about" ? 'location' : undefined}>
{t("본 약관에 대하여")}
</InternalLink>

</nav>
<div className="docmain">
<div className="inner">
<div className="sum">
<div className="sum-row">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M5 12.5l4.5 4.5L19 7.5">

</path>

</svg>
<div>
<b>
{t("시작은 직접 승인합니다")}
</b>
<span>
{t("전략은 승인한 경우에만 연결한 거래소에서 실행합니다.")}
</span>

</div>

</div>
<div className="sum-row">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<rect x="6" y="5" width="4" height="14" rx="1">

</rect>
<rect x="14" y="5" width="4" height="14" rx="1">

</rect>

</svg>
<div>
<b>
{t("언제든 멈춥니다")}
</b>
<span>
{t("실행 중에도 일시정지와 종료를 바로 할 수 있습니다.")}
</span>

</div>

</div>
<div className="sum-row">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M7 3h7l5 5v13H7z">

</path>
<path d="M14 3v5h5M10 13h6M10 17h6">

</path>

</svg>
<div>
<b>
{t("판단 근거를 남깁니다")}
</b>
<span>
{t("거래마다 판단 근거를 기록해 다시 볼 수 있습니다.")}
</span>

</div>

</div>

</div>
<div className="label" id="t-intro">
{t("TETH 서비스 약관")}
</div>
<p className="meta" style={{"marginTop":"16px"}}>
{t("발효일: 2026년 9월 4일")}
</p>
<p>
{t("국가 버전: 대한민국")}
</p>
<h2 id="t-scope">
{t("본 약관에서 다루는 내용")}
</h2>
<p className="intro">
{t("본 서비스 약관을 확인하는 것이 번거로울 수 있다는 점은 이해하지만, 귀하가 TETH 서비스를 사용하면서 TETH에 기대할 수 있는 부분과 TETH가 귀하에게 기대하는 부분을 명확히 해 두는 것은 중요합니다.")}
</p>
<p>
{t("본 서비스 약관에는 TETH의 사업 운영 방식, TETH에 적용되는 법률이 반영되어 있습니다. 귀하가 TETH 서비스와 상호작용하면 본 서비스 약관을 근거로 TETH와의 관계가 정의됩니다. 약관에는 다음과 같은 제목의 주제들이 포함됩니다.")}
</p>
<ul>
<li>
<b>
{t("TETH에 기대할 수 있는 사항")}
</b>
{t(". TETH가 서비스를 제공 및 개발하는 방법을 설명합니다.")}
</li>
<li>
<b>
{t("TETH가 귀하에게 기대하는 사항")}
</b>
{t(". TETH 서비스 사용과 관련된 일정한 규칙들을 정합니다.")}
</li>
<li>
<InternalLink href="/policies/#t-risk" data-t="t-risk" className="lnk">
{t("투자 위험 고지")}
</InternalLink>
{t(". 투자 손실 가능성과 백테스트의 한계, AI 판단의 한계를 설명합니다.")}
</li>
<li>
<InternalLink href="/policies/#t-about" data-t="t-about" className="lnk">
{t("본 약관에 대하여")}
</InternalLink>
{t(". 약관의 수정과 공지, 동의하지 않는 경우의 선택지를 설명합니다.")}
</li>

</ul>
<p>
{t("TETH 서비스에 액세스하거나 서비스를 이용함으로써 귀하는 본 약관에 동의하게 되므로 본 약관을 숙지하는 것이 중요합니다.")}
</p>
<h2 id="t-risk">
{t("투자 위험 고지")}
</h2>
<p>
{t("모든 투자에는 원금 손실 위험이 있습니다. TETH가 제공하는 전략, 백테스트 결과, 시장 해설은 정보 제공을 위한 것이며 투자 조언이 아닙니다. 과거 성과는 미래 수익을 보장하지 않습니다. TETH는 AI이며 실수를 할 수 있습니다. 투자 결정과 그 결과에 대한 최종 책임은 사용자 본인에게 있습니다.")}
</p>
<h2 id="t-auto">
{t("자동매매와 승인")}
</h2>
<p>
{t("검증을 통과한 전략은 사용자가 직접 승인한 경우에만 실행됩니다. 실행 중에도 1회 손실 한도가 적용되며, 사용자는 언제든 일시 정지하거나 종료할 수 있습니다. TETH는 조회, 주문 권한만 사용하며 출금 권한을 요청하지 않습니다.")}
</p>
<h2 id="t-use">
{t("TETH 서비스 사용")}
</h2>
<p>
{t("귀하는 관련 법령과 본 약관을 준수하는 범위에서 서비스를 이용할 수 있습니다. 서비스의 오남용, 시스템에 대한 무단 접근, 타인의 계정 사용은 금지됩니다.")}
</p>
<h2 id="t-about">
{t("본 약관에 대하여")}
</h2>
<p>
{t("TETH는 서비스 개선이나 법령 변경에 따라 본 약관을 수정할 수 있으며, 중대한 변경은 시행 전에 공지합니다. 변경에 동의하지 않는 경우 서비스 이용을 중단하고 계정을 삭제할 수 있습니다.")}
</p>

</div>

</div>

</div>

</section>
<section id="v-technologies" lang={language} className={policyTab === "technologies" ? 'view on' : 'view'}>
<div className="doc">
<nav className="toc" data-toc="">
<InternalLink href="/policies/#x-backtest" data-t="x-backtest" className={activeSection === "x-backtest" ? 'on' : ''} aria-current={activeSection === "x-backtest" ? 'location' : undefined}>
{t("백테스트 엔진")}
</InternalLink>
<InternalLink href="/policies/#x-holdout" data-t="x-holdout" className={activeSection === "x-holdout" ? 'on' : ''} aria-current={activeSection === "x-holdout" ? 'location' : undefined}>
{t("홀드아웃 검증")}
</InternalLink>
<InternalLink href="/policies/#x-engine" data-t="x-engine" className={activeSection === "x-engine" ? 'on' : ''} aria-current={activeSection === "x-engine" ? 'location' : undefined}>
{t("AI 리서치 엔진")}
</InternalLink>
<InternalLink href="/policies/#x-keys" data-t="x-keys" className={activeSection === "x-keys" ? 'on' : ''} aria-current={activeSection === "x-keys" ? 'location' : undefined}>
{t("TETH의 API 키 처리 방식")}
</InternalLink>
<InternalLink href="/policies/#x-retain" data-t="x-retain" className={activeSection === "x-retain" ? 'on' : ''} aria-current={activeSection === "x-retain" ? 'location' : undefined}>
{t("TETH에서 수집한 데이터를 보관하는 방법")}
</InternalLink>

</nav>
<div className="docmain">
<div className="inner" style={{"paddingTop":"64px"}}>
<div className="label">
{t("기술")}
</div>
<p>
{t("TETH는 종종 기존 기술의 한계를 뛰어넘는 아이디어와 제품을 추구합니다. TETH는 사회적 책임을 중요시하는 기업으로서 혁신과 사용자에 대한 적절한 수준의 개인정보 보호 및 보안이 균형을 이룰 수 있도록 노력합니다. TETH의 ")}<InternalLink className="lnk" href="/policies/#privacy">
{t("개인정보 보호원칙")}
</InternalLink>
{t("은 회사의 각 단계에서 결정을 내릴 때 올바른 기준을 제시합니다.")}
</p>
<h2 id="x-backtest">
{t("백테스트 엔진")}
</h2>
<p>
{t("전략은 수년치 실제 시장 데이터 위에서 검증됩니다. 수수료와 슬리피지를 포함해 계산하며, 모든 수치는 재현 가능한 방식으로 기록됩니다.")}
</p>
<h2 id="x-holdout">
{t("홀드아웃 검증")}
</h2>
<p>
{t("과최적화를 막기 위해 일부 기간의 데이터는 연구 단계에서 봉인됩니다. 봉인은 최종 검증 단계에서만 해제되며, 해제 이후에는 전략 수정에 사용되지 않습니다.")}
</p>
<h2 id="x-engine">
{t("AI 리서치 엔진")}
</h2>
<p>
{t("전략 구조화, 수치 검증, 리스크 검토, 설명 생성에 서로 다른 특화 엔진이 사용됩니다. 서로의 결론을 반박하도록 설계되어 있으며, 의견이 불일치하는 경우 그대로 사용자에게 공개합니다.")}
</p>
<h2 id="x-keys">
{t("TETH의 API 키 처리 방식")}
</h2>
<p>
{t("거래소 API 키는 등록 즉시 암호화되어 별도 저장소에 보관됩니다. 조회, 주문 권한만 사용하며 출금 권한은 요청하지 않습니다. 연결 해제 시 키는 즉시 파기됩니다.")}
</p>
<h2 id="x-retain">
{t("TETH에서 수집한 데이터를 보관하는 방법")}
</h2>
<p>
{t("전략, 백테스트, 거래 기록은 서비스 제공과 복기 기능을 위해 계정이 활성인 동안 보관되며, 자세한 내용은 ")}<InternalLink className="lnk" href="/policies/#privacy">
{t("개인정보처리방침")}
</InternalLink>
{t("을 참고합니다.")}
</p>

</div>

</div>

</div>

</section>
<section id="v-faq" lang={language} className={policyTab === "faq" ? 'view on' : 'view'}>
<div className="faqv">
<div className="inner">
<h2>
{t("TETH는 내 개인정보를 어떻게 안전하게 보호합니까?")}
</h2>
<p>
{t("보안과 개인정보는 본인에게도 중요하지만 TETH에게도 중요한 문제입니다. TETH는 전송, 저장 구간 암호화, API 키 분리 보관, 이상 접근 자동 차단 등 강력한 보안을 제공하여 개인정보가 안전하게 보호되고 있으며 원할 때 언제든지 액세스할 수 있다는 믿음을 주는 것을 최우선으로 생각합니다.")}
</p>
<p>
<InternalLink href="/policies/#technologies">
{t("TETH 안전 기술")}
</InternalLink>
{t("을 확인하여 TETH가 사용자의 정보를 보호하는 방식에 대해 자세히 알아볼 수 있습니다.")}
</p>
<h2>
{t("TETH는 내 자산에 접근할 수 있습니까?")}
</h2>
<p>
{t("아니요. TETH는 거래소 API의 조회, 주문 권한만 사용하며, 출금 권한은 어떤 경우에도 요청하거나 저장하지 않습니다. 따라서 TETH가 사용자의 자산을 다른 곳으로 옮기는 것은 기술적으로 불가능합니다.")}
</p>
<h2>
{t("백테스트 결과를 믿어도 됩니까?")}
</h2>
<p>
{t("백테스트는 과거 데이터에 대한 검증이며 미래 수익을 보장하지 않습니다. TETH는 검증 기간을 나눠 과최적화를 줄이지만, 모든 투자에는 손실 위험이 있습니다.")}
</p>
<h2>
{t("내 데이터를 삭제하려면 어떻게 합니까?")}
</h2>
<p>
{t("계정 설정에서 계정 삭제를 요청하면 법적 보관 의무가 있는 정보를 제외한 모든 데이터가 30일 이내에 파기됩니다. 거래소 연결만 해제하는 것도 가능하며, 이 경우 API 키는 즉시 파기됩니다.")}
</p>
<h2>
{t("자동매매를 중단하려면 어떻게 합니까?")}
</h2>
<p>
{t("실행 중 화면에서 언제든 일시 정지 또는 전략 종료를 누를 수 있습니다. 종료 시 보유 포지션은 현재가로 정리되고 이후 새 주문은 발생하지 않습니다.")}
</p>
<h2>
{t("약관이나 방침이 바뀌면 어떻게 알 수 있습니까?")}
</h2>
<p>
{t("중대한 변경은 시행 전에 서비스 내 공지와 이메일로 알려드립니다. 이전 버전은 보관처리된 버전에서 확인할 수 있습니다.")}
</p>

</div>

</div>

</section>

</main>
<p className="sub-help">
{labels.help}<button type="button" onClick={onHelp}>
{labels.ask}
</button>

</p>

  </>
}
