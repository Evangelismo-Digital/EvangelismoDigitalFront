// Dev/preview counterpart of the vercel.json "/analytics" route: forwards the browser's same-origin
// calls to the backend and adds the shared secret, so the secret never reaches the client bundle.
// See docs/cookie-consent-analytics-plan.md (Phase 1).
import type { ProxyOptions } from 'vite'

export const ANALYTICS_PROXY_HEADER = 'x-analytics-proxy'

export interface AnalyticsProxyEnv {
  ANALYTICS_API_URL?: string
  ANALYTICS_PROXY_SECRET?: string
}

/** The `/analytics` proxy entry, or none when the backend URL or secret is not configured. */
export function analyticsProxy(env: AnalyticsProxyEnv): Record<string, ProxyOptions> {
  const target = env.ANALYTICS_API_URL?.trim()
  const secret = env.ANALYTICS_PROXY_SECRET?.trim()
  if (!target || !secret) {
    return {}
  }

  return {
    '/analytics': {
      target,
      changeOrigin: true,
      // X-Forwarded-For carries the visitor's IP: the backend rate-limits and truncates by it.
      xfwd: true,
      headers: { [ANALYTICS_PROXY_HEADER]: secret },
    },
  }
}
