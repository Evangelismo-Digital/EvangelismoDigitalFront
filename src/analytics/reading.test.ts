import { afterEach, describe, expect, it, vi } from 'vitest'
import { PageReading, SCROLL_MILESTONES, articleSlug, scrollDepth } from './reading'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('articleSlug', () => {
  it.each([
    ['/artigo/oMal', 'oMal'],
    ['/artigo/deus-existe/', 'deus-existe'],
    ['/', null],
    ['/privacidade', null],
    ['/artigo/', null],
    ['/artigo/a/b', null],
    ['/x/artigo/a', null],
  ])('%s → %s', (path, slug) => {
    expect(articleSlug(path)).toBe(slug)
  })
})

describe('scrollDepth', () => {
  const element = (top: number, height: number) =>
    ({ getBoundingClientRect: () => ({ top, height }) }) as unknown as Element

  it('measures against the article body when given', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800)

    expect(scrollDepth(element(400, 2000))).toBe(20)   // only 400px of it shown yet
    expect(scrollDepth(element(-1200, 2000))).toBe(100)
    expect(scrollDepth(element(900, 2000))).toBe(0)     // not reached
    expect(scrollDepth(element(-200, 2000))).toBe(50)
    expect(scrollDepth(element(0, 0))).toBe(0)
  })

  it('measures against the whole document otherwise', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800)
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(1200)
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(4000)

    expect(scrollDepth(null)).toBe(50)
  })

  it('reads an empty document as 0', () => {
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(0)

    expect(scrollDepth(null)).toBe(0)
  })
})

describe('PageReading', () => {
  const clock = (start = 1000) => {
    let now = start
    return { now: () => now, advance: (ms: number) => { now += ms } }
  }

  it('counts only the time the tab is visible', () => {
    const time = clock()
    const reading = new PageReading(time.now, true)

    time.advance(3000)
    reading.setVisible(false)
    time.advance(60_000)          // backgrounded: not read
    reading.setVisible(true)
    time.advance(2000)

    expect(reading.durationMs()).toBe(5000)
  })

  it('starts paused when the page opens in a background tab', () => {
    const time = clock()
    const reading = new PageReading(time.now, false)

    time.advance(10_000)
    expect(reading.durationMs()).toBe(0)
    reading.setVisible(true)
    time.advance(1500)
    expect(reading.durationMs()).toBe(1500)
  })

  it('ignores repeated visibility reports', () => {
    const time = clock()
    const reading = new PageReading(time.now, true)

    time.advance(1000)
    reading.setVisible(true)      // already visible: the clock keeps running from the start
    time.advance(1000)
    reading.setVisible(false)
    reading.setVisible(false)
    time.advance(5000)

    expect(reading.durationMs()).toBe(2000)
  })

  it('rounds to whole milliseconds', () => {
    let now = 0
    const reading = new PageReading(() => now, true)
    now = 1234.6

    expect(reading.durationMs()).toBe(1235)
  })

  it('reports each milestone once, as soon as it is reached, and keeps the deepest point', () => {
    const reading = new PageReading(() => 0, true)

    expect(SCROLL_MILESTONES).toEqual([25, 50, 75, 100])
    expect(reading.recordDepth(10)).toEqual([])
    expect(reading.recordDepth(25)).toEqual([25])
    expect(reading.recordDepth(80)).toEqual([50, 75])
    expect(reading.recordDepth(30)).toEqual([])     // scrolling back up
    expect(reading.maxDepth()).toBe(80)
    expect(reading.recordDepth(100)).toEqual([100])
    expect(reading.recordDepth(100)).toEqual([])
    expect(reading.maxDepth()).toBe(100)
  })

  it('starts at depth 0', () => {
    expect(new PageReading(() => 0, true).maxDepth()).toBe(0)
  })
})
