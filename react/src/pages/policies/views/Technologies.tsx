// 약관 페이지의 「기술」 (원본 #v-technologies). 글은 원본 그대로다.
import type { ReactNode } from 'react';

export function Technologies({ toc }: { toc: ReactNode }) {
  return (
    <div className="doc">
      {toc}
      <div className="docmain">
        <div className="inner" style={{ paddingTop: 64 }}>
          <div className="label">기술</div>
          <p>
            {'TETH는 종종 기존 기술의 한계를 뛰어넘는 아이디어와 제품을 추구합니다. TETH는 사회적 책임을 중요시하는 기업으로서 혁신과 사용자에 대한 적절한 수준의 개인정보 보호 및 보안이 균형을 이룰 수 있도록 노력합니다. TETH의 '}
            <a className="lnk" href="#privacy">개인정보 보호원칙</a>
            은 회사의 각 단계에서 결정을 내릴 때 올바른 기준을 제시합니다.
          </p>
          <h2 id="x-backtest">백테스트 엔진</h2>
          <p>전략은 수년치 실제 시장 데이터 위에서 검증됩니다. 수수료와 슬리피지를 포함해 계산하며, 모든 수치는 재현 가능한 방식으로 기록됩니다.</p>
          <h2 id="x-holdout">홀드아웃 검증</h2>
          <p>과최적화를 막기 위해 일부 기간의 데이터는 연구 단계에서 봉인됩니다. 봉인은 최종 검증 단계에서만 해제되며, 해제 이후에는 전략 수정에 사용되지 않습니다.</p>
          <h2 id="x-engine">AI 리서치 엔진</h2>
          <p>전략 구조화, 수치 검증, 리스크 검토, 설명 생성에 서로 다른 특화 엔진이 사용됩니다. 서로의 결론을 반박하도록 설계되어 있으며, 의견이 불일치하는 경우 그대로 사용자에게 공개합니다.</p>
          <h2 id="x-keys">TETH의 API 키 처리 방식</h2>
          <p>거래소 API 키는 등록 즉시 암호화되어 별도 저장소에 보관됩니다. 조회, 주문 권한만 사용하며 출금 권한은 요청하지 않습니다. 연결 해제 시 키는 즉시 파기됩니다.</p>
          <h2 id="x-retain">TETH에서 수집한 데이터를 보관하는 방법</h2>
          <p>
            {'전략, 백테스트, 거래 기록은 서비스 제공과 복기 기능을 위해 계정이 활성인 동안 보관되며, 자세한 내용은 '}
            <a className="lnk" href="#privacy">개인정보처리방침</a>
            을 참고합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
