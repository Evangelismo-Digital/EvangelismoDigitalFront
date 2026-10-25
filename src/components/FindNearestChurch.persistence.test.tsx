import { QueryClient, dehydrate } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import FindNearestChurch from './FindNearestChurch'
import { PERSIST_BUSTER, PERSIST_MAX_AGE_MS, PERSIST_STORAGE_KEY, createPersistOptions } from '../config/queryPersistence'
import { nearestChurchesQueryKey } from '../hook/useNearestChurches'
import { parseNearestChurches } from '../util/nearestChurchesApi'
import { jsonResponse, nearestResponse } from '../test/churchFixtures'
import { createMemoryStorage } from '../test/memoryStorage'

vi.mock('../config/api', () => ({ API_URL: 'http://api.test', WEB3FORMS_ACCESS_KEY: 'test-key' }))

const HOUR_MS = 60 * 60 * 1000

let storage: Storage
let backend: () => Response | Promise<Response>
let fetchMock: MockInstance<typeof fetch>

const backendCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith('http://api.test/'))

/** Mounts the section the way main.tsx does, as a fresh "visit" sharing `storage`. */
const visit = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
  const user = userEvent.setup()
  const view = render(
    <PersistQueryClientProvider client={client} persistOptions={createPersistOptions(storage)}>
      <FindNearestChurch />
    </PersistQueryClientProvider>
  )
  return { user, client, ...view }
}

const search = async (user: ReturnType<typeof userEvent.setup>, cep: string, email = 'maria@email.com') => {
  await user.type(screen.getByLabelText('CEP'), cep)
  await user.type(screen.getByLabelText('Email'), email)
  await user.click(screen.getByRole('button', { name: 'Buscar igrejas' }))
}

/** Writes a saved snapshot as if a previous visit stored `ageMs` ago. */
const seedSavedResult = (ageMs: number, buster = PERSIST_BUSTER) => {
  const savedAt = Date.now() - ageMs
  const client = new QueryClient()
  client.setQueryData(nearestChurchesQueryKey({ cep: '24020085', mode: 'pedestrian' }), parseNearestChurches(nearestResponse()), { updatedAt: savedAt })
  storage.setItem(PERSIST_STORAGE_KEY, JSON.stringify({ timestamp: savedAt, buster, clientState: dehydrate(client) }))
}

const waitForSavedResult = () =>
  waitFor(() => expect(storage.getItem(PERSIST_STORAGE_KEY)).toContain('Igreja Batista Central'), { timeout: 3000 })

beforeEach(() => {
  storage = createMemoryStorage()
  backend = () => jsonResponse(nearestResponse())
  fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
    String(input).startsWith('https://api.web3forms.com/') ? jsonResponse({ success: true, message: 'ok' }) : backend()
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FindNearestChurch with saved results', () => {
  it('saves a successful search, but never the email typed in the form', async () => {
    const { user } = visit()

    await search(user, '24020085', 'maria@email.com')
    await screen.findByRole('region', { name: 'Igrejas mais próximas' })
    await waitForSavedResult()

    const saved = storage.getItem(PERSIST_STORAGE_KEY) ?? ''
    expect(saved).toContain('"buster":"church-list-v3"')
    expect(saved).toContain('"pedestrian"')
    expect(saved).not.toContain('maria@email.com')
  })

  it('does not save a failed search', async () => {
    backend = () => jsonResponse({ message: 'x', code: 'NO_NEARBY_CHURCHES_FOUND' }, 404)
    const { user } = visit()

    await search(user, '24020085')
    await screen.findByRole('alert')
    await new Promise((resolve) => setTimeout(resolve, 1200))

    expect(storage.getItem(PERSIST_STORAGE_KEY) ?? '').not.toContain('"churches","nearest"')
  })

  it('reuses a result saved in a previous visit without calling the backend', async () => {
    const first = visit()
    await search(first.user, '24020085')
    await screen.findByRole('region', { name: 'Igrejas mais próximas' })
    await waitForSavedResult()
    first.unmount()
    fetchMock.mockClear()

    const second = visit()
    await search(second.user, '24020-085')

    expect(await screen.findByRole('region', { name: 'Igrejas mais próximas' })).toBeInTheDocument()
    expect(backendCalls()).toHaveLength(0)
  })

  it('shows an older saved result at once and refreshes it in the background', async () => {
    seedSavedResult(HOUR_MS)
    let release!: (response: Response) => void
    backend = () => new Promise<Response>((resolve) => { release = resolve })
    const { user } = visit()

    await search(user, '24020085')

    expect(await screen.findByRole('region', { name: 'Igrejas mais próximas' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscar igrejas' })).toBeEnabled()
    await waitFor(() => expect(backendCalls()).toHaveLength(1))

    release(jsonResponse(nearestResponse()))
  })

  it('keeps showing the saved result when the background refresh fails', async () => {
    seedSavedResult(HOUR_MS)
    backend = () => jsonResponse(null, 503)
    const { user } = visit()

    await search(user, '24020085')

    expect(await screen.findByRole('region', { name: 'Igrejas mais próximas' })).toBeInTheDocument()
    await waitFor(() => expect(backendCalls()).toHaveLength(2))
    expect(screen.getByRole('region', { name: 'Igrejas mais próximas' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps each travel mode apart: a saved walking result is not shown by car', async () => {
    seedSavedResult(HOUR_MS)
    backend = () => jsonResponse(null, 503)
    const { user } = visit()

    await user.click(screen.getByRole('radio', { name: 'De carro' }))
    await search(user, '24020085')

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Igrejas mais próximas' })).not.toBeInTheDocument()
  })

  it('discards results older than seven days', async () => {
    seedSavedResult(PERSIST_MAX_AGE_MS + HOUR_MS)
    backend = () => jsonResponse(null, 503)
    const { user } = visit()

    await search(user, '24020085')

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Igrejas mais próximas' })).not.toBeInTheDocument()
  })

  // v2 saved a bare list of churches, before results carried the route origin.
  it.each(['church-list-v1', 'church-list-v2'])('discards results saved by an older data format (%s)', async (buster) => {
    seedSavedResult(HOUR_MS, buster)
    backend = () => jsonResponse(null, 503)
    const { user } = visit()

    await search(user, '24020085')

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Igrejas mais próximas' })).not.toBeInTheDocument()
  })
})
