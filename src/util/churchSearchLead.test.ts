import { afterEach, describe, expect, it, vi } from 'vitest'
import { NO_CHURCH_FOUND_TEXT, buildChurchSearchLeadFields, sendChurchSearchLead } from './churchSearchLead'

vi.mock('../config/api', () => ({ API_URL: 'http://api.test', WEB3FORMS_ACCESS_KEY: 'test-key' }))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildChurchSearchLeadFields', () => {
  it('describes the search with the formatted CEP and nearest church', () => {
    expect(buildChurchSearchLeadFields({ email: 'maria@email.com', cep: '24020085', mode: 'pedestrian', nearestChurchName: 'Igreja Batista Central' })).toEqual({
      subject: 'Busca de igreja - CEP 24020-085',
      from_name: 'Evangelismo Digital',
      email: 'maria@email.com',
      cep: '24020-085',
      como_vai: 'a pé',
      igreja_mais_proxima: 'Igreja Batista Central',
      message: 'Nova busca de igreja pelo site Evangelismo Digital:\n\nEmail: maria@email.com\nCEP: 24020-085\nComo vai: a pé\nIgreja mais próxima: Igreja Batista Central',
    })
  })

  it('says none was found when there is no church', () => {
    const fields = buildChurchSearchLeadFields({ email: 'maria@email.com', cep: '24020085', mode: 'transport', nearestChurchName: null })

    expect(NO_CHURCH_FOUND_TEXT).toBe('nenhuma encontrada')
    expect(fields.igreja_mais_proxima).toBe('nenhuma encontrada')
    expect(fields.message).toContain('Igreja mais próxima: nenhuma encontrada')
    expect(fields.como_vai).toBe('de carro')
    expect(fields.message).toContain('Como vai: de carro')
  })
})

describe('sendChurchSearchLead', () => {
  it('posts the lead to Web3Forms with the configured key', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: 'ok' }), { status: 200 })
    )

    await sendChurchSearchLead({ email: 'maria@email.com', cep: '24020085', mode: 'pedestrian', nearestChurchName: null })

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body).toMatchObject({ access_key: 'test-key', subject: 'Busca de igreja - CEP 24020-085', igreja_mais_proxima: 'nenhuma encontrada' })
  })
})
