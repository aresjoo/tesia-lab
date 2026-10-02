// Exact authored structure/SVG: tesia-lab 9fbff821 about/index.html.
// Source copy is supplied separately; no runtime HTML, source scripts or network.
import type { MouseEventHandler, ReactNode } from 'react'
import { InternalLink } from './InternalLink'
import '../client-about-page.css'

export function ClientAboutPage({ copy, onHelp, previewNotice, pricingNotice, faqNotice }: { copy: (text: string) => string; onHelp: MouseEventHandler<HTMLButtonElement>; previewNotice: ReactNode; pricingNotice: ReactNode; faqNotice: ReactNode }) {
  return <main className="ab" id="site-main" tabIndex={-1}>
    <section className="ab-hero">
      <span className="pl-lb">
        {"TETH"}
      </span>
      <h1 className="ab-h1">
        {copy("거래하는 사람을 위한 AI 트레이딩")}
      </h1>
      <p className="ab-d">
        {copy("말로 전략을 만들고, 실제 시장 데이터로 검증하고, 지금 쓰는 거래소 계정에서 실행합니다.")}
      </p>
      <div className="ab-acts">
        <InternalLink className="ab-cta" href="/">
          {copy("무료로 시작하기")}
        </InternalLink>
        <InternalLink className="ab-link" href="/about/#pricing">
          {copy("요금 보기")}
        </InternalLink>
      </div>
      <p className="ab-free">
        {copy("영원히 무료, 카드 등록 없음")}
      </p>
      {previewNotice}
      <div className="ab-heroshot">
        <img src="/client-shots/about/about-live.webp" width="1376" height="900" alt={copy("TETH 터미널, 차트와 판단 패널")} />
      </div>
    </section>
    <section className="ab-sec">
      <h2 className="ab-sh">
        {copy("이렇게 씁니다")}
      </h2>
      <p className="ab-ss">
        {copy("대화에서 시작해 실행까지 한 곳에서 이어집니다.")}
      </p>
      <div className="ab-steps">
        <article className="ab-card rv">
          <div className="ab-tx">
            <span className="pl-lb">
              {copy("대화")}
            </span>
            <h2 className="ab-h">
              {copy("말로 만드는 전략")}
            </h2>
            <p className="ab-d">
              {copy("아이디어를 말하면 TETH가 진입, 청산, 손절 조건이 정해진 전략으로 정리합니다.")}
            </p>
            <ul className="pl-items">
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 5h16v11H8l-4 4z">

                  </path>
                </svg>
                <span>
                  {copy("빠진 조건은 TETH가 먼저 묻습니다")}
                </span>
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01">

                  </path>
                </svg>
                <span>
                  {copy("진입, 청산, 손절 조건으로 정리")}
                </span>
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3l9 5-9 5-9-5z">

                  </path>
                  <path d="M3 13l9 5 9-5">

                  </path>
                </svg>
                <span>
                  {copy("차트 규칙, AI 판단, 혼합 전략")}
                </span>
              </li>
            </ul>
            <InternalLink className="ab-link" href="/">
              {copy("전략 만들기")}
            </InternalLink>
          </div>
          <div className="ab-shot">
            <img src="/client-shots/about/about-plan2.webp" width="844" height="517" loading="lazy" alt={copy("TETH 전략 카드, 자산과 사고파는 조건")} />
          </div>
        </article>
        <article className="ab-card rv">
          <div className="ab-tx">
            <span className="pl-lb">
              {copy("검증")}
            </span>
            <h2 className="ab-h">
              {copy("실제 데이터로 검증")}
            </h2>
            <p className="ab-d">
              {copy("지난 시장 데이터로 전략을 돌려 수익과 위험을 숫자로 확인합니다.")}
            </p>
            <ul className="pl-items">
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="16" rx="2">

                  </rect>
                  <path d="M3 10h18M8 3v4M16 3v4">

                  </path>
                </svg>
                <span>
                  {copy("최근 3개월부터 전체 기간까지")}
                </span>
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6">

                  </path>
                </svg>
                <span>
                  {copy("수익률과 가장 크게 내려간 폭")}
                </span>
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 3h7l5 5v13H7z">

                  </path>
                  <path d="M14 3v5h5M10 13h6M10 17h6">

                  </path>
                </svg>
                <span>
                  {copy("매번의 판단 기록")}
                </span>
              </li>
            </ul>
            <InternalLink className="ab-link" href="/">
              {copy("결과 보기")}
            </InternalLink>
          </div>
          <div className="ab-shot">
            <img src="/client-shots/about/about-backtest2.webp" width="1216" height="700" loading="lazy" alt={copy("TETH 백테스트 결과, 잔고 차트와 판단 기록")} />
          </div>
        </article>
        <article className="ab-card rv">
          <div className="ab-tx">
            <span className="pl-lb">
              {copy("연결")}
            </span>
            <h2 className="ab-h">
              {copy("지금 쓰는 계정 그대로")}
            </h2>
            <p className="ab-d">
              {copy("거래소를 고르고 한 번 승인하면, 전략이 그 계정에서 직접 주문합니다.")}
            </p>
            <ul className="pl-items">
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" rx="1.5">

                  </rect>
                  <rect x="14" y="3" width="7" height="7" rx="1.5">

                  </rect>
                  <rect x="3" y="14" width="7" height="7" rx="1.5">

                  </rect>
                  <rect x="14" y="14" width="7" height="7" rx="1.5">

                  </rect>
                </svg>
                <span>
                  {copy("연결 가능한 거래소 7곳")}{" "}
                  <span className="pl-logos">
                    <img src="/client-broker-assets/app-bitget.png" alt="" width="16" height="16" />
                    <img src="/client-broker-assets/app-binance.png" alt="" width="16" height="16" />
                    <img src="/client-broker-assets/app-okx.png" alt="" width="16" height="16" />
                    <img src="/client-broker-assets/app-bybit.png" alt="" width="16" height="16" />
                    <img src="/client-broker-assets/app-mexc.png" alt="" width="16" height="16" />
                    <img src="/client-broker-assets/app-woox.png" alt="" width="16" height="16" />
                    <img src="/client-broker-assets/app-gate.jpg" alt="" width="16" height="16" />
                  </span>
                </span>
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5">

                  </path>
                </svg>
                <span>
                  {copy("한 번 승인으로 연결")}
                </span>
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="10" rx="2">

                  </rect>
                  <path d="M8 10V7a4 4 0 0 1 8 0v3">

                  </path>
                </svg>
                <span>
                  {copy("연결 권한: 잔고 조회와 주문")}
                </span>
              </li>
            </ul>
            <InternalLink className="ab-link" href="/">
              {copy("거래소 연결하기")}
            </InternalLink>
          </div>
          <div className="ab-shot">
            <img src="/client-shots/about/about-connect.webp" width="900" height="640" loading="lazy" alt={copy("TETH 거래소 선택 화면")} />
          </div>
        </article>
        <article className="ab-card rv">
          <div className="ab-tx">
            <span className="pl-lb">
              {copy("실행")}
            </span>
            <h2 className="ab-h">
              {copy("판단 근거까지 기록")}
            </h2>
            <p className="ab-d">
              {copy("전략이 24시간 시장을 보고, 사고판 이유를 문장으로 남깁니다.")}
            </p>
            <ul className="pl-items">
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9">

                  </circle>
                  <path d="M12 7v5l3 2">

                  </path>
                </svg>
                <span>
                  {copy("24시간 자동 실행")}
                </span>
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.4 1 2.5h6c0-1.1.3-1.9 1-2.5A6 6 0 0 0 12 3z">

                  </path>
                </svg>
                <span>
                  {copy("TETH의 생각과 판단 기록")}
                </span>
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1">

                  </rect>
                  <rect x="14" y="5" width="4" height="14" rx="1">

                  </rect>
                </svg>
                <span>
                  {copy("언제든 일시정지와 긴급 정지")}
                </span>
              </li>
            </ul>
            <InternalLink className="ab-link" href="/">
              {copy("터미널 열기")}
            </InternalLink>
          </div>
          <div className="ab-shot ab-tall">
            <img src="/client-shots/about/about-brain.webp" width="392" height="560" loading="lazy" alt={copy("TETH 터미널 판단 패널")} />
          </div>
        </article>
      </div>
    </section>
    <section className="ab-sec" id="pricing">
      {pricingNotice}<h2 className="ab-sh">
        {copy("이용 방법을 선택합니다")}
      </h2>
      <p className="ab-ss">
        {copy("거래소 계정에 맞는 방법을 고릅니다.")}
      </p>
      <div className="plans pl-grid" id="plans">
        <article className="pl-card pl-hi">
          <div className="pl-top">
            <span className="pl-lb">
              {copy("TETH 초대 계정")}
            </span>
          </div>
          <h3 className="pl-h">
            {copy("거래하는 사람을 위해")}
          </h3>
          <p className="pl-d">
            {copy("TETH 초대로 가입한 거래소 계정으로 이용합니다. 초대 계정이 없다면 거래소에 새로 가입합니다.")}
          </p>
          <div className="pl-price">
            <i>
              {"$"}
            </i>
            <span className="pl-grad">
              {"0"}
            </span>
            <small>
              {copy("/ 월")}
            </small>
          </div>
          <InternalLink className="pl-cta pl-cta-hi" href="/">
            {copy("무료로 시작하기")}
          </InternalLink>
          <div className="pl-sub">
            {copy("포함된 기능")}
          </div>
          <ul className="pl-items">
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M13 2L4 14h6l-1 8 9-12h-6z">

                </path>
              </svg>
              <span>
                {copy("전략 자동 실행")}
              </span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1.5">

                </rect>
                <rect x="14" y="3" width="7" height="7" rx="1.5">

                </rect>
                <rect x="3" y="14" width="7" height="7" rx="1.5">

                </rect>
                <rect x="14" y="14" width="7" height="7" rx="1.5">

                </rect>
              </svg>
              <span>
                {copy("연결 가능한 거래소 7곳")}{" "}
                <span className="pl-logos">
                  <img src="/client-broker-assets/app-bitget.png" alt="" width="16" height="16" />
                  <img src="/client-broker-assets/app-binance.png" alt="" width="16" height="16" />
                  <img src="/client-broker-assets/app-okx.png" alt="" width="16" height="16" />
                  <img src="/client-broker-assets/app-bybit.png" alt="" width="16" height="16" />
                  <img src="/client-broker-assets/app-mexc.png" alt="" width="16" height="16" />
                  <img src="/client-broker-assets/app-woox.png" alt="" width="16" height="16" />
                  <img src="/client-broker-assets/app-gate.jpg" alt="" width="16" height="16" />
                </span>
              </span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9">

                </circle>
                <path d="M12 7v10M9.5 9.5h4a1.75 1.75 0 0 1 0 3.5h-3a1.75 1.75 0 0 0 0 3.5h4">

                </path>
              </svg>
              <span>
                {copy("거래 수수료 환급")}
              </span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 4h8v5a4 4 0 0 1-8 0zM6 6H4a2 2 0 0 0 2 4M18 6h2a2 2 0 0 1-2 4M12 13v4M8 21h8M10 17h4">

                </path>
              </svg>
              <span>
                {copy("전략 대회 참가")}
              </span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2.5">

                </rect>
                <path d="M3 10h18">

                </path>
              </svg>
              <span>
                {copy("카드 등록 없이 이용")}
              </span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="10" width="16" height="10" rx="2">

                </rect>
                <path d="M8 10V7a4 4 0 0 1 8 0v3">

                </path>
              </svg>
              <span>
                {copy("연결 권한: 잔고 조회와 주문")}
              </span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4.5 13a7.5 7.5 0 0 1 15 0">

                </path>
                <rect x="3" y="12.5" width="4" height="6.5" rx="1.5">

                </rect>
                <rect x="17" y="12.5" width="4" height="6.5" rx="1.5">

                </rect>
                <path d="M19 19v1a2 2 0 0 1-2 2h-3">

                </path>
              </svg>
              <span>
                {copy("24시간 고객 지원")}
              </span>
            </li>
          </ul>
          <p className="pl-foot">
            {copy("Bitget, Binance, OKX, Bybit, MEXC는 거래 수수료의 20%, WOO X과 Gate는 50%를 환급합니다. 연결 과정에서 TETH 초대 계정 여부를 확인합니다.")}
          </p>
        </article>
        <article className="pl-card">
          <div className="pl-top">
            <span className="pl-lb">
              {copy("TETH 구독")}
            </span>
          </div>
          <h3 className="pl-h">
            {copy("지금 쓰는 계정 그대로")}
          </h3>
          <p className="pl-d">
            {copy("TETH 초대로 가입하지 않은 거래소 계정도 연결합니다. 기존 계정을 유지하며 전략을 실행합니다.")}
          </p>
          <div className="pl-price">
            <i>
              {"$"}
            </i>
            <span>
              {"280"}
            </span>
            <small>
              {copy("/ 월")}
            </small>
          </div>
          <InternalLink className="pl-cta" href="/">
            {copy("구독으로 시작하기")}
          </InternalLink>
          <div className="pl-sub">
            {copy("구독 혜택")}
          </div>
          <ul className="pl-items">
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M13 2L4 14h6l-1 8 9-12h-6z">

                </path>
              </svg>
              <span>
                {copy("전략 자동 실행")}
              </span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1.5">

                </rect>
                <rect x="14" y="3" width="7" height="7" rx="1.5">

                </rect>
                <rect x="3" y="14" width="7" height="7" rx="1.5">

                </rect>
                <rect x="14" y="14" width="7" height="7" rx="1.5">

                </rect>
              </svg>
              <span>
                {copy("연결 가능한 거래소 7곳")}{" "}
                <span className="pl-logos">
                  <img src="/client-broker-assets/app-bitget.png" alt="" width="16" height="16" />
                  <img src="/client-broker-assets/app-binance.png" alt="" width="16" height="16" />
                  <img src="/client-broker-assets/app-okx.png" alt="" width="16" height="16" />
                  <img src="/client-broker-assets/app-bybit.png" alt="" width="16" height="16" />
                  <img src="/client-broker-assets/app-mexc.png" alt="" width="16" height="16" />
                  <img src="/client-broker-assets/app-woox.png" alt="" width="16" height="16" />
                  <img src="/client-broker-assets/app-gate.jpg" alt="" width="16" height="16" />
                </span>
              </span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 7h11M15 4l3 3-3 3M17 17H6M9 14l-3 3 3 3">

                </path>
              </svg>
              <span>
                {copy("초대 가입 없이 계정 연결")}
              </span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2">

                </rect>
                <path d="M3 10h18M8 3v4M16 3v4">

                </path>
              </svg>
              <span>
                {copy("거래소 7곳 모두 연결")}
              </span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="10" width="16" height="10" rx="2">

                </rect>
                <path d="M8 10V7a4 4 0 0 1 8 0v3">

                </path>
              </svg>
              <span>
                {copy("연결 권한: 잔고 조회와 주문")}
              </span>
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4.5 13a7.5 7.5 0 0 1 15 0">

                </path>
                <rect x="3" y="12.5" width="4" height="6.5" rx="1.5">

                </rect>
                <rect x="17" y="12.5" width="4" height="6.5" rx="1.5">

                </rect>
                <path d="M19 19v1a2 2 0 0 1-2 2h-3">

                </path>
              </svg>
              <span>
                {copy("24시간 고객 지원")}
              </span>
            </li>
          </ul>
          <p className="pl-foot">
            {copy("매월 자동 결제됩니다. 설정의 결제에서 언제든 해지할 수 있으며, 해지 후에도 남은 구독 기간 동안 이용할 수 있습니다.")}
          </p>
        </article>
      </div>
    </section>
    <section className="ab-sec">
      <h2 className="ab-sh">
        {copy("이용 전에 확인합니다")}
      </h2>
      <div className="ab-list rv">
        <div className="ab-row">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="6" width="18" height="14" rx="2.5">

            </rect>
            <path d="M3 10h18M16 15h2">

            </path>
          </svg>
          <div>
            <b>
              {copy("거래 한도")}
            </b>
            <span>
              {copy("전략마다 쓸 금액과 손실 중단 기준을 직접 정합니다.")}
            </span>
          </div>
        </div>
        <div className="ab-row">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2">

            </rect>
            <path d="M3 10h18M8 3v4M16 3v4">

            </path>
          </svg>
          <div>
            <b>
              {copy("검증 기간")}
            </b>
            <span>
              {copy("백테스트는 고른 기간의 실제 시장 데이터로 돌리고, 결과 화면에 기간을 함께 보여 줍니다.")}
            </span>
          </div>
        </div>
        <div className="ab-row">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="10" width="16" height="10" rx="2">

            </rect>
            <path d="M8 10V7a4 4 0 0 1 8 0v3">

            </path>
          </svg>
          <div>
            <b>
              {copy("연결 권한")}
            </b>
            <span>
              {copy("잔고 조회와 주문 권한으로 연결합니다. 연결은 언제든 해제할 수 있습니다.")}
            </span>
          </div>
        </div>
        <div className="ab-row">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 3h7l5 5v13H7z">

            </path>
            <path d="M14 3v5h5M10 13h6M10 17h6">

            </path>
          </svg>
          <div>
            <b>
              {copy("판단 기록")}
            </b>
            <span>
              {copy("거래마다 판단 근거를 기록해 언제든 다시 볼 수 있습니다.")}
            </span>
          </div>
        </div>
      </div>
    </section>
    <section className="ab-sec">
      <h2 className="ab-sh">
        {copy("자주 묻는 질문")}
      </h2>
      <div className="ab-list ab-faq rv" id="faq">
        {faqNotice}<details>
          <summary>
            {copy("TETH는 어떤 서비스입니까?")}
          </summary>
          <p>
            {copy("말로 투자 전략을 만들고, 실제 시장 데이터로 검증하고, 연결한 거래소에서 실행하는 AI 트레이딩 서비스입니다.")}
          </p>
        </details>
        <details>
          <summary>
            {copy("전략은 어떻게 실행합니까?")}
          </summary>
          <p>
            {copy("검증을 마친 전략은 연결한 거래소 계정에서 자동으로 실행합니다. 시작 전에 직접 승인합니다.")}
          </p>
        </details>
        <details>
          <summary>
            {copy("어떤 거래소를 연결합니까?")}
          </summary>
          <p>
            {copy("Bitget, Binance, OKX, Bybit, MEXC, WOO X, Gate 7곳을 연결합니다.")}
          </p>
        </details>
        <details>
          <summary>
            {copy("백테스트 결과는 어디서 확인합니까?")}
          </summary>
          <p>
            {copy("전략을 만들면 바로 검증하고, 결과 화면에서 수익률, 가장 크게 내려간 폭, 판단 기록을 보여 줍니다.")}
          </p>
        </details>
        <details>
          <summary>
            {copy("연결 권한은 무엇입니까?")}
          </summary>
          <p>
            {copy("잔고 조회와 주문 권한으로 연결합니다. 연결은 언제든 해제할 수 있습니다.")}
          </p>
        </details>
        <details>
          <summary>
            {copy("무료로 쓸 수 있습니까?")}
          </summary>
          <p>
            {copy("TETH 초대로 가입한 거래소 계정이면 TETH 초대 계정으로 씁니다. 영원히 무료, 카드 등록 없음입니다.")}
          </p>
        </details>
        <details>
          <summary>
            {copy("모바일 앱이 있습니까?")}
          </summary>
          <p>
            {copy("iOS, Android 앱을 준비하고 있습니다.")}{" "}
            <InternalLink href="/download/">
              {copy("앱 다운로드 페이지")}
            </InternalLink>
            {copy("에서 소식을 확인합니다.")}
          </p>
        </details>
      </div>
    </section>
    <section className="ab-sec">
      <article className="pl-card pl-hi ab-final rv">
        <span className="pl-lb">
          {copy("TETH 초대 계정")}
        </span>
        <h2 className="pl-h">
          {copy("거래하는 사람을 위해")}
        </h2>
        <p className="pl-d">
          {copy("아이디어 하나로 시작합니다. 전략을 만들고 검증한 뒤, 지금 쓰는 거래소에서 실행합니다.")}
        </p>
        <InternalLink className="pl-cta pl-cta-hi" href="/">
          {copy("무료로 시작하기")}
        </InternalLink>
        <p className="ab-free">
          {copy("영원히 무료, 카드 등록 없음")}
        </p>
      </article>
      <p className="ab-help">
        {copy("막히면 상담원이 24시간 답합니다.")}{" "}
        <button className="ab-link" type="button" onClick={onHelp}>
          {copy("상담원에게 묻기")}
        </button>
      </p>
    </section>
  </main>
}
