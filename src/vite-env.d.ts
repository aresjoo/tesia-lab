/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 소유자 운영 AI 프록시 origin. 미설정이면 앱은 Mock(스크립트 응답)으로만 동작한다. */
  readonly VITE_TETH_AI_PROXY?: string
  readonly VITE_E2E_FAST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
