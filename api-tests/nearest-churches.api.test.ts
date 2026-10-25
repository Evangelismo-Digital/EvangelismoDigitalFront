import { beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { API_BASE_URL, CEPS, assertBackendIsUp, getNearest } from './backend'
import {
  MAX_CHURCHES,
  NearestChurchesError,
  fetchNearestChurches,
  parseNearestChurches,
} from '../src/util/nearestChurchesApi'
import isErrorResponse from '../src/util/isErrorResponse'
import { buildGoogleMapsUrl } from '../src/util/googleMapsUrl'
import type { TravelMode } from '../src/util/travelMode'

const MAX_DISTANCE_KM: Record<TravelMode, number> = { pedestrian: 10, transport: 150 }

/** The full response contract, stricter than the frontend parser (which tolerates bad items). */
const responseContract = z.object({
  nearestChurchesInfo: z.array(z.object({
    publicId: z.string().uuid(),
    name: z.string().min(1),
    address: z.string().min(1).nullable(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    distanceKm: z.number().nonnegative(),
    distanceMeters: z.number().nonnegative(),
  }).strict()),
  // Where every route starts: the point the CEP resolved to.
  origin: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).strict(),
  totalFound: z.number().int().nonnegative(),
  precision: z.string().min(1),
  coordinatesProviderName: z.string().min(1).optional(),
  mode: z.enum(['pedestrian', 'transport']),
}).strict()

const expectKind = async (promise: Promise<unknown>, kind: NearestChurchesError['kind']) => {
  const error = await promise.catch((e: unknown) => e)
  expect(error, `expected a NearestChurchesError(${kind})`).toBeInstanceOf(NearestChurchesError)
  expect((error as NearestChurchesError).kind).toBe(kind)
}

beforeAll(assertBackendIsUp)

describe(`GET ${API_BASE_URL}/churches/nearest — success contract`, () => {
  it.each([
    [CEPS.niteroiCentro, 'pedestrian'],
    [CEPS.niteroiCentro, 'transport'],
    [CEPS.icarai, 'pedestrian'],
    [CEPS.rioCentro, 'pedestrian'],
    [CEPS.rioCentro, 'transport'],
  ] as const)('CEP %s by %s matches the contract the frontend relies on', async (cep, mode) => {
    const { status, body } = await getNearest(`cep=${cep}&mode=${mode}`)

    expect(status).toBe(200)
    const data = responseContract.parse(body)
    expect(data.mode).toBe(mode)

    const churches = data.nearestChurchesInfo
    expect(churches.length).toBeGreaterThan(0)
    expect(churches.length).toBeLessThanOrEqual(MAX_CHURCHES)
    expect(new Set(churches.map((c) => c.publicId)).size).toBe(churches.length)
    expect(data.totalFound).toBe(churches.length)

    const distances = churches.map((c) => c.distanceKm)
    expect(distances).toEqual([...distances].sort((a, b) => a - b))
    for (const church of churches) {
      expect(church.distanceKm).toBeLessThanOrEqual(MAX_DISTANCE_KM[mode])
      expect(church.distanceMeters).toBeCloseTo(church.distanceKm * 1000, 3)
    }
  })

  it('walks by default when no mode is sent', async () => {
    const { status, body } = await getNearest(`cep=${CEPS.niteroiCentro}`)

    expect(status).toBe(200)
    expect(responseContract.parse(body).mode).toBe('pedestrian')
  })

  it('accepts the CEP with a hyphen, as typed in the form, and answers the same', async () => {
    const plain = await getNearest(`cep=${CEPS.niteroiCentro}&mode=pedestrian`)
    const hyphen = await getNearest('cep=24020-085&mode=pedestrian')

    expect(hyphen.status).toBe(200)
    expect(hyphen.body).toEqual(plain.body)
  })

  it('serves a repeated search from cache, identically and fast', async () => {
    const first = await getNearest(`cep=${CEPS.icarai}&mode=transport`)
    const second = await getNearest(`cep=${CEPS.icarai}&mode=transport`)

    expect(second.status).toBe(200)
    expect(second.body).toEqual(first.body)
    expect(second.ms).toBeLessThan(500)
  })

  it('returns walking and driving results under separate cache entries', async () => {
    const walking = responseContract.parse((await getNearest(`cep=${CEPS.niteroiCentro}&mode=pedestrian`)).body)
    const driving = responseContract.parse((await getNearest(`cep=${CEPS.niteroiCentro}&mode=transport`)).body)

    expect(walking.mode).toBe('pedestrian')
    expect(driving.mode).toBe('transport')
    expect(driving.nearestChurchesInfo.map((c) => c.distanceKm)).not.toEqual(walking.nearestChurchesInfo.map((c) => c.distanceKm))
  })
})

describe('real data shown in the cards', () => {
  it('every church returned around Niterói and Rio has plausible coordinates and a Google Maps link', async () => {
    const seen = new Map<string, z.infer<typeof responseContract>['nearestChurchesInfo'][number]>()
    for (const cep of [CEPS.niteroiCentro, CEPS.rioCentro]) {
      for (const mode of ['pedestrian', 'transport'] as const) {
        const data = responseContract.parse((await getNearest(`cep=${cep}&mode=${mode}`)).body)
        data.nearestChurchesInfo.forEach((church) => seen.set(church.publicId, church))
      }
    }

    expect(seen.size).toBeGreaterThan(0)
    for (const church of seen.values()) {
      // Rio de Janeiro state bounding box: catches swapped or zeroed coordinates.
      expect(church.lat, church.name).toBeGreaterThan(-23.4)
      expect(church.lat, church.name).toBeLessThan(-20.7)
      expect(church.lon, church.name).toBeGreaterThan(-44.9)
      expect(church.lon, church.name).toBeLessThan(-40.9)
      expect(church.name.trim(), church.name).toBe(church.name)
      expect(church.name, 'shown as-is, so never all lowercase').not.toBe(church.name.toLowerCase())
      // One format for every card: "Rua, nº - Bairro, Cidade - UF".
      expect(church.address, church.name).toMatch(/^[^,]+, [^,]+ - [^,]+, [^,]+ - RJ$/)
      const [item] = parseNearestChurches({ nearestChurchesInfo: [church] }).churches
      expect(buildGoogleMapsUrl(item)).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=-2\d\.\d{6}%2C-4\d\.\d{6}$/)
    }
  })
})

describe('route origin', () => {
  /** Great-circle distance in km: no route can be shorter than this. */
  const straightLineKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
    const rad = Math.PI / 180
    const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2
      + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2
    return 2 * 6371 * Math.asin(Math.sqrt(h))
  }

  it('is the same point on foot and by car: it belongs to the CEP, not to the mode', async () => {
    const walking = responseContract.parse((await getNearest(`cep=${CEPS.icarai}&mode=pedestrian`)).body)
    const driving = responseContract.parse((await getNearest(`cep=${CEPS.icarai}&mode=transport`)).body)

    expect(walking.origin).toEqual(driving.origin)
  })

  it('is where the distances were measured from: no route is shorter than the straight line from it', async () => {
    for (const cep of [CEPS.niteroiCentro, CEPS.icarai, CEPS.rioCentro]) {
      const data = responseContract.parse((await getNearest(`cep=${cep}&mode=pedestrian`)).body)
      for (const church of data.nearestChurchesInfo) {
        // 1 % slack for the router snapping both ends onto the street network.
        expect(church.distanceKm, `${cep} → ${church.name}`).toBeGreaterThanOrEqual(straightLineKm(data.origin, church) * 0.99)
      }
    }
  })

  it('differs between CEPs in different neighbourhoods', async () => {
    const niteroi = responseContract.parse((await getNearest(`cep=${CEPS.niteroiCentro}&mode=pedestrian`)).body)
    const rio = responseContract.parse((await getNearest(`cep=${CEPS.rioCentro}&mode=pedestrian`)).body)

    expect(straightLineKm(niteroi.origin, rio.origin)).toBeGreaterThan(3)
  })
})

describe('walking routes', () => {
  it('stay on land: a walk from Niterói never reaches a church across Guanabara Bay', async () => {
    const data = responseContract.parse((await getNearest(`cep=${CEPS.niteroiCentro}&mode=pedestrian`)).body)

    expect(data.nearestChurchesInfo.length).toBeGreaterThan(0)
    for (const church of data.nearestChurchesInfo) {
      expect(church.address, church.name).toMatch(/, Niterói - RJ$/)
    }
  })
})

describe('frontend API client against the real backend', () => {
  it.each(['pedestrian', 'transport'] as const)('fetchNearestChurches returns ready-to-render churches by %s', async (mode) => {
    const { churches, origin } = await fetchNearestChurches({ cep: '24020-085', mode }, undefined, API_BASE_URL)

    expect(origin).not.toBeNull()
    expect(churches.length).toBeGreaterThan(0)
    expect(churches.length).toBeLessThanOrEqual(MAX_CHURCHES)
    for (const church of churches) {
      expect(Object.keys(church).sort()).toEqual(['address', 'distanceKm', 'id', 'latitude', 'longitude', 'name'])
      expect(church.id).toMatch(/^[0-9a-f-]{36}$/)
    }
  })

  it('the parser keeps every church the real backend sends (none dropped as malformed)', async () => {
    const { body } = await getNearest(`cep=${CEPS.rioCentro}&mode=transport`)
    const raw = responseContract.parse(body).nearestChurchesInfo

    expect(parseNearestChurches(body).churches.map((c) => c.id)).toEqual(raw.map((c) => c.publicId))
  })

  it.each([CEPS.inexistent, CEPS.fakeCep])('maps the inexistent CEP %s to "cep-not-found"', async (cep) => {
    const { status, body } = await getNearest(`cep=${cep}&mode=pedestrian`)
    expect(status).toBe(404)
    expect(isErrorResponse(body)).toBe(true)
    expect(body).toMatchObject({ code: 'INVALID_CEP' })

    await expectKind(fetchNearestChurches({ cep, mode: 'pedestrian' }, undefined, API_BASE_URL), 'cep-not-found')
  })

  // On foot this used to answer 503 (Geoapify refuses walking matrices over 100 km), which hid the
  // "Ver igrejas de carro" fallback behind "verifique sua conexão".
  it.each(['transport', 'pedestrian'] as const)('maps a CEP too far from every church by %s to "no-churches"', async (mode) => {
    const { status, body } = await getNearest(`cep=${CEPS.saoPaulo}&mode=${mode}`)
    expect(status).toBe(404)
    expect(body).toMatchObject({ code: 'NO_NEARBY_CHURCHES_FOUND' })

    await expectKind(fetchNearestChurches({ cep: CEPS.saoPaulo, mode }, undefined, API_BASE_URL), 'no-churches')
  })

  it('maps a malformed CEP (400 VALIDATION_ERROR) to "cep-not-found"', async () => {
    const { status, body } = await getNearest('cep=1234')
    expect(status).toBe(400)
    expect(isErrorResponse(body)).toBe(true)
    expect(body).toMatchObject({ message: expect.stringContaining('CEP inválido'), code: 'VALIDATION_ERROR' })

    await expectKind(fetchNearestChurches({ cep: '1234', mode: 'pedestrian' }, undefined, API_BASE_URL), 'cep-not-found')
  })

  it('rejects a travel mode outside the contract with 400', async () => {
    const { status, body } = await getNearest(`cep=${CEPS.niteroiCentro}&mode=bicycle`)

    expect(status).toBe(400)
    expect(body).toMatchObject({ message: expect.stringContaining('pedestrian'), code: 'VALIDATION_ERROR' })
  })

  it('maps an unreachable backend to "unavailable"', async () => {
    await expectKind(fetchNearestChurches({ cep: CEPS.niteroiCentro, mode: 'pedestrian' }, undefined, 'http://127.0.0.1:9'), 'unavailable')
  })
})
