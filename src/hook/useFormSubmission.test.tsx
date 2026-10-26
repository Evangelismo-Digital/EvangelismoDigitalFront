import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import useFormSubmission from './useFormSubmission'

vi.mock('../config/api', () => ({ API_URL: 'http://api.test', WEB3FORMS_ACCESS_KEY: 'test-key' }))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

const sentBody = (fetchMock: ReturnType<typeof vi.fn>) => JSON.parse(String(fetchMock.mock.calls[0][1]?.body))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useFormSubmission', () => {
  it('sends the contact form to Web3Forms with every field', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: 'ok' }), { status: 200 })
    )
    const { result } = renderHook(() => useFormSubmission(), { wrapper })

    await act(() => result.current.mutateAsync({
      name: 'Maria', lastName: 'Silva', email: 'maria@email.com', phone: '21987654321', decisaoPorCristo: true, location: 'Niterói',
    }))

    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.web3forms.com/submit')
    expect(sentBody(fetchMock as unknown as ReturnType<typeof vi.fn>)).toEqual({
      access_key: 'test-key',
      subject: 'Novo contato - Maria Silva',
      from_name: 'Evangelismo Digital',
      name: 'Maria Silva',
      email: 'maria@email.com',
      telefone: '(21) 98765-4321',
      decisao_por_cristo: 'Sim',
      localizacao: 'Niterói',
      message: 'Novo contato recebido através do site Evangelismo Digital:\n\nNome: Maria Silva\nEmail: maria@email.com\nTelefone: (21) 98765-4321\nDecisão por Cristo: Sim\nLocalização: Niterói',
    })
  })

  it('marks a missing phone, location and no decision', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: 'ok' }), { status: 200 })
    )
    const { result } = renderHook(() => useFormSubmission(), { wrapper })

    await act(() => result.current.mutateAsync({
      name: 'João', lastName: 'Souza', email: 'joao@email.com', phone: '', decisaoPorCristo: false, location: '',
    }))

    const body = sentBody(fetchMock as unknown as ReturnType<typeof vi.fn>)
    expect(body.telefone).toBe('Não informado')
    expect(body.decisao_por_cristo).toBe('Não')
    expect(body.localizacao).toBe('Não informada')
    expect(body.message).toBe('Novo contato recebido através do site Evangelismo Digital:\n\nNome: João Souza\nEmail: joao@email.com\nDecisão por Cristo: Não')
  })

  it('rejects when Web3Forms reports a failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: 'Limite excedido' }), { status: 429 })
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useFormSubmission(), { wrapper })

    await expect(act(() => result.current.mutateAsync({
      name: 'Maria', lastName: 'Silva', email: 'maria@email.com', phone: '', decisaoPorCristo: false, location: null,
    }))).rejects.toThrow('Limite excedido')
  })
})
