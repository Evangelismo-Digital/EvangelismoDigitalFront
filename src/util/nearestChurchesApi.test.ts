import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_CHURCHES,
  formatCep,
  maskCep,
  NEAREST_CHURCHES_MESSAGES,
  NearestChurchesError,
  fetchNearestChurches,
  normalizeCep,
  parseNearestChurches,
} from './nearestChurchesApi'
import { backendChurch, fiveBackendChurches, jsonResponse, nearestResponse } from '../test/churchFixtures'

const BASE = 'http://api.test'

const stubFetch = (impl: (...args: Parameters<typeof fetch>) => Promise<Response>) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(impl)

const expectKind = async (promise: Promise<unknown>, kind: NearestChurchesError['kind']) => {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(NearestChurchesError)
  expect((error as NearestChurchesError).kind).toBe(kind)
  expect((error as NearestChurchesError).message).toBe(NEAREST_CHURCHES_MESSAGES[kind])
  expect((error as NearestChurchesError).name).toBe('NearestChurchesError')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NEAREST_CHURCHES_MESSAGES', () => {
  it('uses the approved pt-BR copy', () => {
    expect(NEAREST_CHURCHES_MESSAGES).toEqual({
      'cep-not-found': 'Não encontramos esse CEP. Confira os números e tente de novo.',
      'no-churches': 'Ainda não temos igrejas cadastradas perto desse CEP.',
      'rate-limited': 'Muitas buscas seguidas. Aguarde um minuto e tente novamente.',
      'unavailable': 'Não foi possível buscar agora. Verifique sua conexão e tente novamente.',
    })
  })
})

describe('normalizeCep', () => {
  it.each([
    ['24020-085', '24020085'],
    ['24020085', '24020085'],
    [' 24.020-085 ', '24020085'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeCep(input)).toBe(expected)
  })
})

describe('maskCep', () => {
  it.each([
    ['', ''],
    ['2', '2'],
    ['24020', '24020'],
    ['240200', '24020-0'],
    ['24020085', '24020-085'],
    ['24020-085', '24020-085'],
    ['240200851234', '24020-085'],
    ['24a02b0', '24020'],
  ])('masks %j as %j', (input, expected) => {
    expect(maskCep(input)).toBe(expected)
  })
})

describe('formatCep', () => {
  it.each([
    ['24020085', '24020-085'],
    ['24020-085', '24020-085'],
    ['2402008', '2402008'],
    ['abc', 'abc'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatCep(input)).toBe(expected)
  })
})

describe('parseNearestChurches', () => {
  it('maps every church to the UI model in distance order', () => {
    const { churches } = parseNearestChurches(nearestResponse())

    expect(churches).toHaveLength(5)
    expect(churches.map((c) => c.id)).toEqual(['church-1', 'church-2', 'church-3', 'church-4', 'church-5'])
    expect(churches[0]).toEqual({
      id: 'church-1',
      name: 'Igreja Batista Central',
      address: 'R. da Conceição, 100 - Centro, Niterói - RJ',
      latitude: -22.894623,
      longitude: -43.123987,
      distanceKm: 0.45,
    })
  })

  it('sorts unsorted input and keeps at most MAX_CHURCHES', () => {
    const many = [...fiveBackendChurches(), backendChurch({ publicId: 'church-0', distanceKm: 0.1, distanceMeters: 100 })].reverse()

    const { churches } = parseNearestChurches(nearestResponse(many))

    expect(MAX_CHURCHES).toBe(5)
    expect(churches).toHaveLength(5)
    expect(churches.map((c) => c.id)).toEqual(['church-0', 'church-1', 'church-2', 'church-3', 'church-4'])
  })

  it.each([
    ['empty publicId', { publicId: '' }],
    ['empty name', { name: '' }],
    ['latitude out of range', { lat: 91 }],
    ['latitude below range', { lat: -91 }],
    ['longitude out of range', { lon: 181 }],
    ['longitude below range', { lon: -181 }],
    ['negative distance', { distanceKm: -1 }],
    ['negative meters', { distanceMeters: -1 }],
    ['non-numeric latitude', { lat: '-22.9' as unknown as number }],
  ])('drops a church with %s', (_label, override) => {
    const { churches } = parseNearestChurches(nearestResponse([backendChurch(override), backendChurch({ publicId: 'ok' })]))

    expect(churches.map((c) => c.id)).toEqual(['ok'])
  })

  it('keeps churches whose address is null', () => {
    expect(parseNearestChurches(nearestResponse([backendChurch({ address: null })])).churches[0].address).toBeNull()
  })

  it('reads where the routes start, in the UI coordinate names', () => {
    expect(parseNearestChurches(nearestResponse()).origin).toEqual({ latitude: -22.8968, longitude: -43.1236 })
    expect(parseNearestChurches({ ...nearestResponse(), origin: { lat: 90, lon: -180 } }).origin).toEqual({ latitude: 90, longitude: -180 })
    expect(parseNearestChurches({ ...nearestResponse(), origin: { lat: -90, lon: 180 } }).origin).toEqual({ latitude: -90, longitude: 180 })
  })

  it.each([
    ['missing (older backend)', undefined],
    ['null', null],
    ['latitude above range', { lat: 90.1, lon: -43 }],
    ['latitude below range', { lat: -90.1, lon: -43 }],
    ['longitude above range', { lat: -22, lon: 180.1 }],
    ['longitude below range', { lat: -22, lon: -180.1 }],
    ['not finite', { lat: Number.NaN, lon: -43 }],
    ['a string', { lat: '-22.9', lon: -43 }],
    ['missing longitude', { lat: -22.9 }],
  ])('has no origin when it is %s, and still lists the churches', (_label, origin) => {
    const parsed = parseNearestChurches({ ...nearestResponse(), origin })

    expect(parsed.origin).toBeNull()
    expect(parsed.churches).toHaveLength(5)
  })

  it('reports no churches for an empty list', () => {
    expect(() => parseNearestChurches(nearestResponse([]))).toThrow(NEAREST_CHURCHES_MESSAGES['no-churches'])
  })

  it('reports no churches when every item is malformed', () => {
    expect(() => parseNearestChurches(nearestResponse([backendChurch({ lat: 200 })]))).toThrow(NEAREST_CHURCHES_MESSAGES['no-churches'])
  })

  it.each([null, {}, { nearestChurchesInfo: 'x' }, []])('reports unavailable for malformed body %j', (body) => {
    expect(() => parseNearestChurches(body)).toThrow(NEAREST_CHURCHES_MESSAGES.unavailable)
  })
})

describe('fetchNearestChurches', () => {
  it('requests GET /churches/nearest with the normalized CEP and returns churches', async () => {
    const fetchMock = stubFetch(async () => jsonResponse(nearestResponse()))
    const controller = new AbortController()

    const { churches, origin } = await fetchNearestChurches({ cep: '24020-085', mode: 'pedestrian' }, controller.signal, BASE)

    expect(churches).toHaveLength(5)
    expect(origin).toEqual({ latitude: -22.8968, longitude: -43.1236 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/churches/nearest?cep=24020085&mode=pedestrian`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  })

  it('sends the transport mode when travelling by car', async () => {
    const fetchMock = stubFetch(async () => jsonResponse(nearestResponse()))

    await fetchNearestChurches({ cep: '24020-085', mode: 'transport' }, undefined, BASE)

    expect(String(fetchMock.mock.calls[0][0])).toBe(`${BASE}/churches/nearest?cep=24020085&mode=transport`)
  })

  it.each([
    [404, { message: 'O CEP fornecido não existe.', code: 'INVALID_CEP' }, 'cep-not-found'],
    [404, { message: 'Coordenadas não encontradas.', code: 'COORDINATES_NOT_FOUND' }, 'cep-not-found'],
    [404, { message: 'Nenhuma igreja encontrada nas proximidades.', code: 'NO_NEARBY_CHURCHES_FOUND' }, 'no-churches'],
    [404, { message: 'Lista de igrejas vazia!', code: 'EMPTY_CHURCH_LIST' }, 'no-churches'],
    [404, { message: 'Igreja não encontrada.', code: 'CHURCH_NOT_FOUND' }, 'unavailable'],
    [404, { unexpected: true }, 'unavailable'],
    [400, { message: 'CEP inválido', code: 'VALIDATION_ERROR' }, 'cep-not-found'],
    [429, { message: 'Too many requests', code: 'RATE_LIMITED' }, 'rate-limited'],
    [500, { message: 'Falha ao processar o CEP 24020085.', code: 'CEP_TO_LAT_LON_FAILED' }, 'unavailable'],
    [500, { message: 'x', code: 'NO_NEARBY_CHURCHES_FOUND' }, 'unavailable'],
    [500, { message: 'x', code: 'INVALID_CEP' }, 'unavailable'],
    [503, null, 'unavailable'],
    [504, null, 'unavailable'],
  ] as const)('maps HTTP %i %j to %s', async (status, body, kind) => {
    stubFetch(async () => jsonResponse(body, status))

    await expectKind(fetchNearestChurches({ cep: '24020085', mode: 'pedestrian' }, undefined, BASE), kind)
  })

  it('treats a non-JSON error body as unavailable', async () => {
    stubFetch(async () => new Response('<html>Bad gateway</html>', { status: 502 }))

    await expectKind(fetchNearestChurches({ cep: '24020085', mode: 'pedestrian' }, undefined, BASE), 'unavailable')
  })

  it('treats a non-JSON success body as unavailable', async () => {
    stubFetch(async () => new Response('not json', { status: 200 }))

    await expectKind(fetchNearestChurches({ cep: '24020085', mode: 'pedestrian' }, undefined, BASE), 'unavailable')
  })

  it('maps network failures to unavailable', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expectKind(fetchNearestChurches({ cep: '24020085', mode: 'pedestrian' }, undefined, BASE), 'unavailable')
  })

  it('rethrows the abort error untouched when the request is cancelled', async () => {
    const controller = new AbortController()
    const abortError = new DOMException('Aborted', 'AbortError')
    stubFetch(async () => {
      controller.abort()
      throw abortError
    })

    await expect(fetchNearestChurches({ cep: '24020085', mode: 'pedestrian' }, controller.signal, BASE)).rejects.toBe(abortError)
  })

  it('uses the configured API_URL by default', async () => {
    const fetchMock = stubFetch(async () => jsonResponse(nearestResponse()))

    await fetchNearestChurches({ cep: '24020085', mode: 'pedestrian' })

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/churches\/nearest\?cep=24020085&mode=pedestrian$/)
  })
})
