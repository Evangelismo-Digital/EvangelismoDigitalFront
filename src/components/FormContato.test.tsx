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

describe('FormContato phone (optional)', () => {
  const sentBody = (fetchMock: { mock: { calls: unknown[][] } }) =>
    JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))

  it('starts blank, unchecked and with every error line reserved', () => {
    renderForm()

    for (const label of [/Nome:/, /Sobrenome:/, /Email:/, /Telefone \(opcional\):/]) {
      const input = screen.getByLabelText(label)
      expect(input).toHaveValue('')
      const errorLine = input.closest('label')!.nextElementSibling
      expect(errorLine?.textContent).toBe('\u00A0')
    }
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('masks the phone while typing and sends it formatted', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, message: 'ok' }), { status: 200 }))
    const user = renderForm()
    const phone = screen.getByLabelText(/Telefone \(opcional\):/)

    await user.type(phone, '21987654321')
    expect(phone).toHaveValue('(21) 98765-4321')
    await fillAndSend(user)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(sentBody(fetchMock)).toMatchObject({ telefone: '(21) 98765-4321' })
  })

  it('sends without a phone', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, message: 'ok' }), { status: 200 }))
    const user = renderForm()

    await fillAndSend(user)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(sentBody(fetchMock)).toMatchObject({ telefone: 'Não informado' })
  })

  it('blocks an invalid phone with a message', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const user = renderForm()

    await user.type(screen.getByLabelText(/Telefone \(opcional\):/), '2198765')
    await fillAndSend(user)

    expect(await screen.findByText('Digite um telefone válido com DDD.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('FormContato fields and accessibility', () => {
  it('renders decorative icons with aria-hidden inside inputs and submit button', () => {
    renderForm()
    const nameInput = screen.getByLabelText(/Nome:/)
    const lastNameInput = screen.getByLabelText(/Sobrenome:/)
    const emailInput = screen.getByLabelText(/Email:/)
    const phoneInput = screen.getByLabelText(/Telefone \(opcional\):/)
    const submitBtn = screen.getByRole('button', { name: /Enviar/ })

    for (const el of [nameInput, lastNameInput, emailInput, phoneInput, submitBtn]) {
      const svg = (el.parentElement?.querySelector('svg') || el.querySelector('svg'))!
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      expect(svg).toHaveAttribute('focusable', 'false')
    }
  })

  it('sets aria-invalid, aria-describedby and role="alert" when validation fails', async () => {
    const user = renderForm()
    const nameInput = screen.getByLabelText(/Nome:/)
    const lastNameInput = screen.getByLabelText(/Sobrenome:/)
    const emailInput = screen.getByLabelText(/Email:/)
    const phoneInput = screen.getByLabelText(/Telefone \(opcional\):/)

    expect(nameInput).not.toHaveAttribute('aria-invalid')
    expect(nameInput).not.toHaveAttribute('aria-describedby')
    expect(lastNameInput).not.toHaveAttribute('aria-invalid')
    expect(lastNameInput).not.toHaveAttribute('aria-describedby')
    expect(emailInput).not.toHaveAttribute('aria-invalid')
    expect(emailInput).not.toHaveAttribute('aria-describedby')
    expect(phoneInput).not.toHaveAttribute('aria-invalid')
    expect(phoneInput).not.toHaveAttribute('aria-describedby')

    await user.click(screen.getByRole('button', { name: /Enviar/ }))

    const nameError = await screen.findByText('Digite um nome.')
    const lastNameError = await screen.findByText('Digite um sobrenome.')
    const emailError = await screen.findByText('Digite um email.')

    expect(nameInput).toHaveAttribute('aria-invalid', 'true')
    expect(nameInput).toHaveAttribute('aria-describedby', 'form-contato-name-error')
    expect(nameError).toHaveAttribute('role', 'alert')
    expect(nameError).toHaveAttribute('id', 'form-contato-name-error')

    expect(lastNameInput).toHaveAttribute('aria-invalid', 'true')
    expect(lastNameInput).toHaveAttribute('aria-describedby', 'form-contato-lastname-error')
    expect(lastNameError).toHaveAttribute('role', 'alert')
    expect(lastNameError).toHaveAttribute('id', 'form-contato-lastname-error')

    expect(emailInput).toHaveAttribute('aria-invalid', 'true')
    expect(emailInput).toHaveAttribute('aria-describedby', 'form-contato-email-error')
    expect(emailError).toHaveAttribute('role', 'alert')
    expect(emailError).toHaveAttribute('id', 'form-contato-email-error')

    await user.type(phoneInput, '219')
    await user.tab()
    const phoneError = await screen.findByText('Digite um telefone válido com DDD.')
    expect(phoneInput).toHaveAttribute('aria-invalid', 'true')
    expect(phoneInput).toHaveAttribute('aria-describedby', 'form-contato-phone-error')
    expect(phoneError).toHaveAttribute('role', 'alert')
    expect(phoneError).toHaveAttribute('id', 'form-contato-phone-error')
  })
})
