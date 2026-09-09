/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 소유자 운영 AI 프록시 origin. 미설정이면 앱은 Mock(스크립트 응답)으로만 동작한다. */
  readonly VITE_TETH_AI_PROXY?: string
  /** 'true' 일 때만 프로덕션 빌드에서 멀티모델 연출(DEMO_MODE)이 켜진다. */
  readonly VITE_TETH_DEMO_MODE?: string
  readonly VITE_E2E_FAST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
