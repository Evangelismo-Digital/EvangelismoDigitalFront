import { QueryClient, dehydrate } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PERSIST_BUSTER,
  PERSIST_MAX_AGE_MS,
  PERSIST_STORAGE_KEY,
  createPersistOptions,
  getSafeStorage,
  shouldPersistQuery,
} from './queryPersistence'
import { createMemoryStorage } from '../test/memoryStorage'

const query = (queryKey: readonly unknown[], status: 'success' | 'error' | 'pending') =>
  ({ queryKey, state: { status } }) as Parameters<typeof shouldPersistQuery>[0]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('persistence policy', () => {
  it('keeps saved results for seven days under a versioned key', () => {
    expect(PERSIST_MAX_AGE_MS).toBe(7 * 24 * 60 * 60 * 1000)
    expect(PERSIST_BUSTER).toBe('church-list-v3')
    expect(PERSIST_STORAGE_KEY).toBe('evangelismo-digital-query-cache')
  })
})

describe('shouldPersistQuery', () => {
  it('saves successful nearest-church lookups', () => {
    expect(shouldPersistQuery(query(['churches', 'nearest', '24020085'], 'success'))).toBe(true)
  })

  it.each([
    ['a failed lookup', query(['churches', 'nearest', '24020085'], 'error')],
    ['a pending lookup', query(['churches', 'nearest', '24020085'], 'pending')],
    ['another churches query', query(['churches', 'all'], 'success')],
    ['another scope with the same kind', query(['users', 'nearest'], 'success')],
    ['an unrelated query', query(['forms'], 'success')],
  ])('skips %s', (_label, q) => {
    expect(shouldPersistQuery(q)).toBe(false)
  })
})

describe('getSafeStorage', () => {
  it('returns localStorage and leaves no probe behind', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const storage = getSafeStorage()

    expect(setItem).toHaveBeenCalledWith('evangelismo-digital-query-cache-probe', 'evangelismo-digital-query-cache-probe')
    expect(storage).toBe(window.localStorage)
    expect(window.localStorage.getItem(`${PERSIST_STORAGE_KEY}-probe`)).toBeNull()
  })

  it('returns undefined when the browser blocks storage writes', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    expect(getSafeStorage()).toBeUndefined()
  })

  it('returns undefined when localStorage itself is inaccessible', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError')
    })

    expect(getSafeStorage()).toBeUndefined()
  })
})

describe('createPersistOptions', () => {
  it('wires max age, buster and the church-only filter', () => {
    const options = createPersistOptions(createMemoryStorage())

    expect(options.maxAge).toBe(PERSIST_MAX_AGE_MS)
    expect(options.buster).toBe(PERSIST_BUSTER)
    expect(options.dehydrateOptions?.shouldDehydrateQuery).toBe(shouldPersistQuery)
  })

  it('round-trips a client snapshot through the given storage key', async () => {
    const storage = createMemoryStorage()
    const { persister } = createPersistOptions(storage)
    const client = new QueryClient()
    client.setQueryData(['churches', 'nearest', '24020085'], [{ id: 'church-1' }])
    const snapshot = { timestamp: Date.now(), buster: PERSIST_BUSTER, clientState: dehydrate(client) }

    await persister.persistClient(snapshot)
    await vi.waitFor(() => expect(storage.getItem(PERSIST_STORAGE_KEY)).not.toBeNull(), { timeout: 3000 })

    expect(await persister.restoreClient()).toEqual(snapshot)
  })

  it('falls back to a no-op persister without storage', async () => {
    const { persister } = createPersistOptions(undefined)

    await persister.persistClient({ timestamp: 1, buster: PERSIST_BUSTER, clientState: { mutations: [], queries: [] } })

    expect(await persister.restoreClient()).toBeUndefined()
  })

  it('uses the browser storage by default', () => {
    expect(createPersistOptions().persister).toBeDefined()
  })
})
