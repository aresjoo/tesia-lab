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
  ...CLIENT_ABOUT_ASSETS,
  ...CLIENT_DOWNLOAD_ASSETS,
] as const
