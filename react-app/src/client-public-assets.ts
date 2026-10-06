/** Exact compiled information-page images. No glob-based server access. */
import type { ClientLanguage } from './client-preferences'

const LOCALIZED_ARTWORK = {
  '/client-shots/dl-chat.webp': {
    'en': '/client-shots/localized/en/dl-chat.webp',
    'ja': '/client-shots/localized/ja/dl-chat.webp',
    'zh-CN': '/client-shots/localized/zh-CN/dl-chat.webp',
    'zh-TW': '/client-shots/localized/zh-TW/dl-chat.webp',
    'es': '/client-shots/localized/es/dl-chat.webp',
    'fr': '/client-shots/localized/fr/dl-chat.webp',
  },
  '/client-shots/dl-report.webp': {
    'en': '/client-shots/localized/en/dl-report.webp',
    'ja': '/client-shots/localized/ja/dl-report.webp',
    'zh-CN': '/client-shots/localized/zh-CN/dl-report.webp',
    'zh-TW': '/client-shots/localized/zh-TW/dl-report.webp',
    'es': '/client-shots/localized/es/dl-report.webp',
    'fr': '/client-shots/localized/fr/dl-report.webp',
  },
  '/client-shots/dl-live.webp': {
    'en': '/client-shots/localized/en/dl-live.webp',
    'ja': '/client-shots/localized/ja/dl-live.webp',
    'zh-CN': '/client-shots/localized/zh-CN/dl-live.webp',
    'zh-TW': '/client-shots/localized/zh-TW/dl-live.webp',
    'es': '/client-shots/localized/es/dl-live.webp',
    'fr': '/client-shots/localized/fr/dl-live.webp',
  },
  '/client-shots/about/about-live.webp': {
    'en': '/client-shots/localized/en/about-live.webp',
    'ja': '/client-shots/localized/ja/about-live.webp',
    'zh-CN': '/client-shots/localized/zh-CN/about-live.webp',
    'zh-TW': '/client-shots/localized/zh-TW/about-live.webp',
    'es': '/client-shots/localized/es/about-live.webp',
    'fr': '/client-shots/localized/fr/about-live.webp',
  },
  '/client-shots/about/about-plan2.webp': {
    'en': '/client-shots/localized/en/about-plan2.webp',
    'ja': '/client-shots/localized/ja/about-plan2.webp',
    'zh-CN': '/client-shots/localized/zh-CN/about-plan2.webp',
    'zh-TW': '/client-shots/localized/zh-TW/about-plan2.webp',
    'es': '/client-shots/localized/es/about-plan2.webp',
    'fr': '/client-shots/localized/fr/about-plan2.webp',
  },
  '/client-shots/about/about-backtest2.webp': {
    'en': '/client-shots/localized/en/about-backtest2.webp',
    'ja': '/client-shots/localized/ja/about-backtest2.webp',
    'zh-CN': '/client-shots/localized/zh-CN/about-backtest2.webp',
    'zh-TW': '/client-shots/localized/zh-TW/about-backtest2.webp',
    'es': '/client-shots/localized/es/about-backtest2.webp',
    'fr': '/client-shots/localized/fr/about-backtest2.webp',
  },
  '/client-shots/about/about-connect.webp': {
    'en': '/client-shots/localized/en/about-connect.webp',
    'ja': '/client-shots/localized/ja/about-connect.webp',
    'zh-CN': '/client-shots/localized/zh-CN/about-connect.webp',
    'zh-TW': '/client-shots/localized/zh-TW/about-connect.webp',
    'es': '/client-shots/localized/es/about-connect.webp',
    'fr': '/client-shots/localized/fr/about-connect.webp',
  },
  '/client-shots/about/about-brain.webp': {
    'en': '/client-shots/localized/en/about-brain.webp',
    'ja': '/client-shots/localized/ja/about-brain.webp',
    'zh-CN': '/client-shots/localized/zh-CN/about-brain.webp',
    'zh-TW': '/client-shots/localized/zh-TW/about-brain.webp',
    'es': '/client-shots/localized/es/about-brain.webp',
    'fr': '/client-shots/localized/fr/about-brain.webp',
  },
} as const

/** Source-artwork illustrations; not current app/live-account screenshots. */
export function clientPublicScreenshot(source: keyof typeof LOCALIZED_ARTWORK, language: ClientLanguage): string {
  return language === 'ko' ? source : LOCALIZED_ARTWORK[source][language]
}
export const CLIENT_LOCALIZED_ARTWORK_ASSETS = Object.values(LOCALIZED_ARTWORK).flatMap(row => Object.values(row))

export const CLIENT_DOWNLOAD_ASSETS = ['/client-shots/dl-chat.webp', '/client-shots/dl-report.webp', '/client-shots/dl-live.webp'] as const
export const CLIENT_ABOUT_ASSETS = [
  '/client-shots/about/about-live.webp', '/client-shots/about/about-plan2.webp',
  '/client-shots/about/about-backtest2.webp', '/client-shots/about/about-connect.webp',
  '/client-shots/about/about-brain.webp',
  '/client-broker-assets/app-bitget.png', '/client-broker-assets/app-binance.png',
  '/client-broker-assets/app-okx.png', '/client-broker-assets/app-bybit.png',
  '/client-broker-assets/app-mexc.png', '/client-broker-assets/app-woox.png',
  '/client-broker-assets/app-gate.jpg',
] as const
export const CLIENT_PUBLIC_ASSETS = [
  '/client-trading-intro/ai/chatgpt.png',
  '/client-trading-intro/ai/claude.png',
  '/client-trading-intro/ai/deepseek.png',
  '/client-trading-intro/ai/gemini.png',
  '/client-trading-intro/ai/grok.png',
  '/client-trading-intro/ai/kimi.png',
  '/client-trading-intro/ai/mistral.png',
  '/client-trading-intro/ai/perplexity.png',
  '/client-trading-intro/ai/qwen.png',
  '/client-trading-intro/buffett.jpg',
  '/client-trading-intro/halo.mp4',
  '/client-trading-intro/hero-tiles-end.jpg',
  "/assets/logos/bitget-512.png",
  ...CLIENT_ABOUT_ASSETS,
  ...CLIENT_DOWNLOAD_ASSETS,
  ...CLIENT_LOCALIZED_ARTWORK_ASSETS,
] as const
