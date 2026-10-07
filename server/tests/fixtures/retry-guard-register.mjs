import { registerHooks } from 'node:module';

const fixture = new URL('./retry-guard-sdk.mjs', import.meta.url).href;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@anthropic-ai/sdk') return { url: fixture, shortCircuit: true };
  return next(specifier, context);
} });

const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
  const target = new URL(String(url));
  if (!['127.0.0.1', 'localhost'].includes(target.hostname)) throw new Error('EXTERNAL_NETWORK_FORBIDDEN');
  return nativeFetch(url, options);
};
