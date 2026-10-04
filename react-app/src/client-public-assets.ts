/** Exact compiled information-page images. No glob-based server access. */
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
] as const
