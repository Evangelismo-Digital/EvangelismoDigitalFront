import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import useNearestChurches, {
  NEAREST_CHURCHES_STALE_TIME_MS,
  nearestChurchesQueryOptions,
  nearestChurchesQueryKey,
  shouldRetryNearestChurches,
} from './useNearestChurches'
import { NearestChurchesError } from '../util/nearestChurchesApi'
import { jsonResponse, nearestResponse } from '../test/churchFixtures'

const createWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('nearestChurchesQueryKey', () => {
  it('keys formatted and raw CEPs identically', () => {
    expect(nearestChurchesQueryKey({ cep: '24020-085', mode: 'pedestrian' })).toEqual(['churches', 'nearest', '24020085', 'pedestrian'])
    expect(nearestChurchesQueryKey({ cep: '24020085', mode: 'pedestrian' })).toEqual(nearestChurchesQueryKey({ cep: '24020-085', mode: 'pedestrian' }))
  })

  it('keys each travel mode separately', () => {
    expect(nearestChurchesQueryKey({ cep: '24020085', mode: 'transport' })).toEqual(['churches', 'nearest', '24020085', 'transport'])
    expect(nearestChurchesQueryKey({ cep: '24020085', mode: 'transport' })).not.toEqual(nearestChurchesQueryKey({ cep: '24020085', mode: 'pedestrian' }))
  })

  it('gives the idle (null CEP) query its own key', () => {
    expect(nearestChurchesQueryKey(null)).toEqual(['churches', 'nearest', null])
  })
})

describe('NEAREST_CHURCHES_STALE_TIME_MS', () => {
  it('keeps a result fresh for five minutes', () => {
    expect(NEAREST_CHURCHES_STALE_TIME_MS).toBe(300_000)
  })
})

describe('shouldRetryNearestChurches', () => {
  it('retries an unavailable failure once', () => {
    expect(shouldRetryNearestChurches(0, new NearestChurchesError('unavailable'))).toBe(true)
    expect(shouldRetryNearestChurches(1, new NearestChurchesError('unavailable'))).toBe(false)
  })

  it.each(['cep-not-found', 'no-churches', 'rate-limited'] as const)('never retries %s', (kind) => {
    expect(shouldRetryNearestChurches(0, new NearestChurchesError(kind))).toBe(false)
  })

  it('never retries unknown errors', () => {
    expect(shouldRetryNearestChurches(0, new Error('boom'))).toBe(false)
  })
})

describe('nearestChurchesQueryOptions', () => {
  it('lets imperative fetches share the hook cache entry', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(nearestResponse()))
    const { client, wrapper } = createWrapper()

    const { result } = renderHook(() => useNearestChurches({ cep: '24020085', mode: 'pedestrian' }), { wrapper })
    const imperative = await client.fetchQuery(nearestChurchesQueryOptions({ cep: '24020-085', mode: 'pedestrian' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(imperative).toEqual(result.current.data)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps results in memory as long as they may be persisted', () => {
    expect(nearestChurchesQueryOptions({ cep: '24020085', mode: 'pedestrian' }).gcTime).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('is disabled only while the CEP is null', () => {
    expect(nearestChurchesQueryOptions(null).enabled).toBe(false)
    expect(nearestChurchesQueryOptions({ cep: '24020085', mode: 'pedestrian' }).enabled).toBe(true)
  })
})

describe('useNearestChurches', () => {
  it('stays idle and does not fetch while the CEP is null', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const { client, wrapper } = createWrapper()

    const { result } = renderHook(() => useNearestChurches(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(client.getQueryCache().find({ queryKey: ['churches', 'nearest', null] })).toBeDefined()
  })

  it('loads the churches for a CEP', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(nearestResponse()))
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useNearestChurches({ cep: '24020-085', mode: 'pedestrian' }), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.churches.map((c) => c.id)).toEqual(['church-1', 'church-2', 'church-3', 'church-4', 'church-5'])
    expect(result.current.data?.origin).toEqual({ latitude: -22.8968, longitude: -43.1236 })
  })

  it('fetches again when only the travel mode changes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse(nearestResponse()))
    const { wrapper } = createWrapper()

    const walking = renderHook(() => useNearestChurches({ cep: '24020085', mode: 'pedestrian' }), { wrapper })
    await waitFor(() => expect(walking.result.current.isSuccess).toBe(true))
    const driving = renderHook(() => useNearestChurches({ cep: '24020085', mode: 'transport' }), { wrapper })
    await waitFor(() => expect(driving.result.current.isSuccess).toBe(true))

    expect(fetchMock.mock.calls.map(([url]) => String(url).split('?')[1])).toEqual([
      'cep=24020085&mode=pedestrian',
      'cep=24020085&mode=transport',
    ])
  })

  it('reuses the cached result when the same CEP is searched again', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(nearestResponse()))
    const { wrapper } = createWrapper()

    const first = renderHook(() => useNearestChurches({ cep: '24020085', mode: 'pedestrian' }), { wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    first.unmount()

    const second = renderHook(() => useNearestChurches({ cep: '24020-085', mode: 'pedestrian' }), { wrapper })

    expect(second.result.current.isSuccess).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a transient failure once, then succeeds', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(null, 503))
      .mockResolvedValueOnce(jsonResponse(nearestResponse()))
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useNearestChurches({ cep: '24020085', mode: 'pedestrian' }), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('surfaces a rate-limit error without retrying', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ message: 'x', code: 'RATE_LIMITED' }, 429))
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useNearestChurches({ cep: '24020085', mode: 'pedestrian' }), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as NearestChurchesError).kind).toBe('rate-limited')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not refetch on window focus', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(nearestResponse()))
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useNearestChurches({ cep: '24020085', mode: 'pedestrian' }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    window.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
