import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalyticsEvent } from './client'
import { EventQueue, FLUSH_INTERVAL_MS, MAX_BATCH_BYTES, MAX_EVENTS_PER_BATCH, toBatches } from './queue'

const view = (n: number, extra: Partial<AnalyticsEvent> = {}): AnalyticsEvent => ({ eventType: 'page_view', path: `/p${n}`, ...extra })
const views = (count: number) => Array.from({ length: count }, (_, n) => view(n))
const bytes = (events: AnalyticsEvent[]) => new TextEncoder().encode(JSON.stringify({ events })).length

describe('toBatches', () => {
  it('respects the backend limits: at most 50 events and under 16 KiB per request', () => {
    expect(MAX_EVENTS_PER_BATCH).toBe(50)
    expect(MAX_BATCH_BYTES).toBe(15 * 1024)
    expect(FLUSH_INTERVAL_MS).toBe(10_000)
  })

  it('splits by count', () => {
    const batches = toBatches(views(120))

    expect(batches.map((b) => b.length)).toEqual([50, 50, 20])
    expect(batches.flat()).toEqual(views(120))
  })

  it('keeps exactly 50 in one batch', () => {
    expect(toBatches(views(50)).map((b) => b.length)).toEqual([50])
  })

  it('splits by size, counting accented text in UTF-8 bytes', () => {
    const heavy = Array.from({ length: 40 }, (_, n) => view(n, { title: 'ç'.repeat(400) }))

    const batches = toBatches(heavy)

    expect(batches.length).toBeGreaterThan(1)
    expect(batches.flat()).toEqual(heavy)
    for (const batch of batches) {
      expect(bytes(batch)).toBeLessThanOrEqual(MAX_BATCH_BYTES)
    }
  })

  it('fills a batch right up to the size limit, not one event short', () => {
    const event = view(0, { title: 'a'.repeat(300) })
    const perBatch = Math.floor((MAX_BATCH_BYTES - bytes([])) / (bytes([event]) - bytes([]) + 1))
    const many = Array.from({ length: perBatch + 1 }, () => event)

    const [first] = toBatches(many)

    expect(bytes(first)).toBeLessThanOrEqual(MAX_BATCH_BYTES)
    expect(bytes([...first, event])).toBeGreaterThan(MAX_BATCH_BYTES)
  })

  /** An event whose title pads a body of `events` to exactly `target` bytes. */
  const sized = (events: AnalyticsEvent[], target: number): AnalyticsEvent => {
    const base = view(99, { title: '' })
    const missing = target - bytes([...events, base])
    return view(99, { title: 'a'.repeat(missing) })
  }

  it('accepts an event that fills a request exactly to the limit', () => {
    const exact = sized([], MAX_BATCH_BYTES)

    expect(bytes([exact])).toBe(MAX_BATCH_BYTES)
    expect(toBatches([exact])).toEqual([[exact]])
  })

  it('keeps two events in one request when together they are exactly at the limit', () => {
    const first = view(1)
    const second = sized([first], MAX_BATCH_BYTES)

    expect(bytes([first, second])).toBe(MAX_BATCH_BYTES)
    expect(toBatches([first, second])).toEqual([[first, second]])
  })

  it('drops an event too large to ever be accepted, keeping the rest', () => {
    const huge = view(1, { referrer: 'x'.repeat(MAX_BATCH_BYTES) })

    expect(toBatches([view(0), huge, view(2)])).toEqual([[view(0), view(2)]])
  })

  it('has nothing to send for no events', () => {
    expect(toBatches([])).toEqual([])
  })
})

describe('EventQueue', () => {
  let send: ReturnType<typeof vi.fn<(events: AnalyticsEvent[], keepalive: boolean) => Promise<boolean>>>

  beforeEach(() => {
    vi.useFakeTimers()
    send = vi.fn(async () => true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const readyQueue = async () => {
    const queue = new EventQueue(send, Promise.resolve(true))
    await vi.advanceTimersByTimeAsync(0)
    return queue
  }

  it('sends nothing before the session is open, then everything collected meanwhile', async () => {
    let openSession!: () => void
    const queue = new EventQueue(send, new Promise<void>((resolve) => { openSession = resolve }))

    queue.enqueue(view(1))
    await queue.flush(false)
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS)
    expect(send).not.toHaveBeenCalled()

    openSession()
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS)
    expect(send).toHaveBeenCalledWith([view(1)], false)
  })

  it('flushes every ten seconds, not before', async () => {
    const queue = await readyQueue()

    queue.enqueue(view(1))
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS - 1)
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('does not call the network when there is nothing to send', async () => {
    const queue = await readyQueue()

    await queue.flush(true)

    expect(send).not.toHaveBeenCalled()
  })

  it('passes keepalive through for flushes made while leaving', async () => {
    const queue = await readyQueue()
    queue.enqueue(view(1))

    await queue.flush(true)

    expect(send).toHaveBeenCalledWith([view(1)], true)
  })

  it('sends each event once', async () => {
    const queue = await readyQueue()
    queue.enqueue(view(1))

    await queue.flush(false)
    await queue.flush(false)

    expect(send).toHaveBeenCalledTimes(1)
  })

  it('tries a failed batch once more with the next flush, then drops it', async () => {
    send.mockResolvedValueOnce(false).mockResolvedValueOnce(false)
    const queue = await readyQueue()
    queue.enqueue(view(1))

    await queue.flush(false)
    queue.enqueue(view(2))
    await queue.flush(false)
    await queue.flush(false)

    expect(send.mock.calls.map(([events]) => events)).toEqual([[view(1)], [view(1), view(2)], [view(2)]])
  })

  it('clear() drops pending and retried events and stops the timer', async () => {
    send.mockResolvedValueOnce(false)
    const queue = await readyQueue()
    queue.enqueue(view(1))
    await queue.flush(false)
    queue.enqueue(view(2))

    queue.clear()
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 3)
    await queue.flush(true)

    expect(send).toHaveBeenCalledTimes(1)
  })

  it('clear() really stops the old timer: the next flush comes ten seconds after the next event', async () => {
    const queue = await readyQueue()
    queue.enqueue(view(1))
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS / 2)

    queue.clear()
    queue.enqueue(view(2))
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS / 2)   // the old timer would fire here
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS / 2)

    expect(send).toHaveBeenCalledWith([view(2)], false)
  })

  it('starts one timer however many events arrive, and a new one after clear()', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const queue = await readyQueue()

    queue.enqueue(view(1))
    queue.enqueue(view(2))
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)

    queue.clear()
    queue.enqueue(view(3))
    expect(setIntervalSpy).toHaveBeenCalledTimes(2)
  })

  it('clear() before any event is harmless', async () => {
    const queue = await readyQueue()

    expect(() => queue.clear()).not.toThrow()
  })
})
