import { describe, expect, it } from 'vitest'
import { ANALYTICS_PROXY_HEADER, analyticsProxy } from './analytics-proxy'

describe('analyticsProxy', () => {
  it('forwards /analytics to the backend with the secret and the visitor IP', () => {
    expect(analyticsProxy({ ANALYTICS_API_URL: 'http://localhost:3333', ANALYTICS_PROXY_SECRET: 's'.repeat(32) })).toEqual({
      '/analytics': {
        target: 'http://localhost:3333',
        changeOrigin: true,
        xfwd: true,
        headers: { 'x-analytics-proxy': 's'.repeat(32) },
      },
    })
    expect(ANALYTICS_PROXY_HEADER).toBe('x-analytics-proxy')
  })

  it('trims both values', () => {
    const proxy = analyticsProxy({ ANALYTICS_API_URL: ' http://api.test ', ANALYTICS_PROXY_SECRET: ' secret ' })

    expect(proxy['/analytics']).toMatchObject({ target: 'http://api.test', headers: { 'x-analytics-proxy': 'secret' } })
  })

  it.each([
    [{}],
    [{ ANALYTICS_API_URL: 'http://api.test' }],
    [{ ANALYTICS_PROXY_SECRET: 'secret' }],
    [{ ANALYTICS_API_URL: '  ', ANALYTICS_PROXY_SECRET: 'secret' }],
    [{ ANALYTICS_API_URL: 'http://api.test', ANALYTICS_PROXY_SECRET: '  ' }],
  ])('proxies nothing until both the URL and the secret are set (%j)', (env) => {
    expect(analyticsProxy(env)).toEqual({})
  })
})
