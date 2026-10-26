import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FormContato from './FormContato'
import { track } from '../analytics/analytics'

vi.mock('../config/api', () => ({ API_URL: 'http://api.test', WEB3FORMS_ACCESS_KEY: 'test-key' }))
vi.mock('../analytics/analytics', () => ({ track: vi.fn() }))

const formEvents = () => vi.mocked(track).mock.calls.map(([event]) => event)

const renderForm = () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FormContato />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

const fillAndSend = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/Nome:/), 'Maria')
  await user.type(screen.getByLabelText(/Sobrenome:/), 'Silva')
  await user.type(screen.getByLabelText(/Email:/), 'maria@email.com')
  await user.click(screen.getByRole('button', { name: /Enviar/ }))
}

beforeEach(() => {
  window.history.replaceState(null, '', '/artigo/oMal')
})

afterEach(() => {
  vi.mocked(track).mockClear()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('FormContato analytics (only reaches the backend with consent)', () => {
  it('records the start once, on the first keystroke, and a successful send, never the fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, message: 'ok' }), { status: 200 }))
    const user = renderForm()

    await fillAndSend(user)

    await waitFor(() => expect(formEvents()).toHaveLength(2))
    expect(formEvents()).toEqual([
      { eventType: 'form_start', path: '/artigo/oMal', payload: { form: 'contato-artigo' } },
      { eventType: 'form_submit', path: '/artigo/oMal', payload: { form: 'contato-artigo', result: 'success' } },
    ])
    expect(JSON.stringify(formEvents())).not.toMatch(/Maria|Silva|maria@/)
  })

  it('counts a new filling-in after a successful send as a new start', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, message: 'ok' }), { status: 200 }))
    const user = renderForm()
    await fillAndSend(user)
    await waitFor(() => expect(formEvents()).toHaveLength(2))
    await user.keyboard('{Escape}')

    await user.type(screen.getByLabelText(/Nome:/), 'J')

    expect(formEvents().map((e) => e.eventType)).toEqual(['form_start', 'form_submit', 'form_start'])
  })

  it('records a failed send as an error, and does not count a retry as a new start', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: false, message: 'falhou' }), { status: 400 }))
    const user = renderForm()

    await fillAndSend(user)
    await waitFor(() => expect(formEvents()).toHaveLength(2))
    await user.type(screen.getByLabelText(/Nome:/), 'x')

    expect(formEvents()).toEqual([
      { eventType: 'form_start', path: '/artigo/oMal', payload: { form: 'contato-artigo' } },
      { eventType: 'form_submit', path: '/artigo/oMal', payload: { form: 'contato-artigo', result: 'error' } },
    ])
  })
})
