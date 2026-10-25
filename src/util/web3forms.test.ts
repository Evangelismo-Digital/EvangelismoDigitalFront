import { afterEach, describe, expect, it, vi } from 'vitest'
import { WEB3FORMS_URL, postToWeb3Forms } from './web3forms'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('postToWeb3Forms', () => {
  it('posts the fields with the access key as JSON', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ success: true, message: 'ok' }))

    await expect(postToWeb3Forms({ subject: 'Assunto', email: 'a@b.com' }, 'key-123')).resolves.toEqual({ success: true, message: 'ok' })

    expect(WEB3FORMS_URL).toBe('https://api.web3forms.com/submit')
    expect(fetchMock).toHaveBeenCalledWith('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ access_key: 'key-123', subject: 'Assunto', email: 'a@b.com' }),
    })
  })

  it('refuses to send without an access key', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    await expect(postToWeb3Forms({}, '')).rejects.toThrow('Chave do Web3Forms não configurada no ambiente (CONFIG_WEB3FORMS_ACCESS_KEY).')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws the service message when it reports failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ success: false, message: 'Chave inválida' }))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(postToWeb3Forms({}, 'key')).rejects.toThrow('Chave inválida')
  })

  it('throws on an HTTP error even if the body claims success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ success: true, message: 'Erro interno' }, 500))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(postToWeb3Forms({}, 'key')).rejects.toThrow('Erro interno')
  })

  it('falls back to a generic message when the failure has none', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ success: false, message: '' }, 400))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(postToWeb3Forms({}, 'key')).rejects.toThrow('Erro ao enviar formulário. Tente novamente mais tarde.')
    expect(consoleError).toHaveBeenCalledWith('Web3Forms error response:', { success: false, message: '' })
  })

  it('reports an unreadable body even with HTTP 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not json', { status: 200 }))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(postToWeb3Forms({}, 'key')).rejects.toThrow('Erro ao processar resposta do servidor.')
  })

  it('reports an unreadable response body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>', { status: 502 }))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(postToWeb3Forms({}, 'key')).rejects.toThrow('Erro ao processar resposta do servidor.')
  })
})
