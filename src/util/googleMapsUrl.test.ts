import { describe, expect, it } from 'vitest'
import {
  buildGoogleMapsUrl,
  formatDistancePtBr,
  toChurchItem,
  type ChurchItem,
  type PublicNearbyChurch,
} from './googleMapsUrl'

const church: ChurchItem = {
  id: 'abc',
  name: 'Igreja Central',
  address: 'Rua A, 10 - Centro, Niterói - RJ, 24020-000',
  latitude: -22.906847,
  longitude: -43.172897,
  distanceKm: 1.42,
}

describe('toChurchItem', () => {
  it('maps the backend contract to the UI model', () => {
    const backend: PublicNearbyChurch = {
      publicId: 'pub-1',
      name: 'Igreja Central',
      address: null,
      lat: -22.9,
      lon: -43.1,
      distanceKm: 0.45,
      distanceMeters: 450,
    }

    expect(toChurchItem(backend)).toEqual({
      id: 'pub-1',
      name: 'Igreja Central',
      address: null,
      latitude: -22.9,
      longitude: -43.1,
      distanceKm: 0.45,
    })
  })
})

describe('buildGoogleMapsUrl', () => {
  it('pins the exact coordinate by default', () => {
    expect(buildGoogleMapsUrl(church)).toBe(
      'https://www.google.com/maps/search/?api=1&query=-22.906847%2C-43.172897'
    )
  })

  it('builds a directions URL without origin', () => {
    expect(buildGoogleMapsUrl(church, 'directions')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-22.906847%2C-43.172897'
    )
  })

  it.each(['walking', 'driving'] as const)('adds travelmode=%s to directions', (travelMode) => {
    expect(buildGoogleMapsUrl(church, 'directions', travelMode)).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=-22.906847%2C-43.172897&travelmode=${travelMode}`
    )
  })

  it('starts directions at the given origin (the searched CEP), not at the device', () => {
    const origin = { latitude: -22.8968, longitude: -43.1236 }

    expect(buildGoogleMapsUrl(church, 'directions', 'walking', origin)).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=-22.896800%2C-43.123600&destination=-22.906847%2C-43.172897&travelmode=walking'
    )
    expect(buildGoogleMapsUrl({ ...church, googlePlaceId: 'P1' }, 'directions', 'driving', origin)).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=-22.896800%2C-43.123600&destination=-22.906847%2C-43.172897&destination_place_id=P1&travelmode=driving'
    )
  })

  it.each([undefined, null])('leaves the origin to the device when there is none (%j)', (origin) => {
    expect(buildGoogleMapsUrl(church, 'directions', 'walking', origin)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-22.906847%2C-43.172897&travelmode=walking'
    )
  })

  it('never puts an origin on the exact-point search', () => {
    expect(buildGoogleMapsUrl(church, 'exact-point', 'walking', { latitude: -22.8968, longitude: -43.1236 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=-22.906847%2C-43.172897'
    )
  })

  it.each([
    [{ latitude: 91, longitude: -43 }, /Latitude inválida/],
    [{ latitude: -22.9, longitude: Number.NaN }, /Longitude inválida/],
  ])('rejects an invalid origin %j', (origin, message) => {
    expect(() => buildGoogleMapsUrl(church, 'directions', 'walking', origin)).toThrow(message)
  })

  it('never adds travelmode to the exact-point search', () => {
    expect(buildGoogleMapsUrl(church, 'exact-point', 'driving')).not.toContain('travelmode')
  })

  it('puts travelmode after the place id', () => {
    expect(buildGoogleMapsUrl({ ...church, googlePlaceId: 'P1' }, 'directions', 'walking')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-22.906847%2C-43.172897&destination_place_id=P1&travelmode=walking'
    )
  })

  it('pads and rounds coordinates to 6 decimals with dot notation and no spaces', () => {
    const url = buildGoogleMapsUrl({ ...church, latitude: -22.9, longitude: -43.12345678 })

    expect(url).toContain('query=-22.900000%2C-43.123457')
    expect(url).not.toMatch(/[\s,]/)
  })

  it('appends an encoded place id when present', () => {
    const withPlace = { ...church, googlePlaceId: 'ChIJ a/b' }

    expect(buildGoogleMapsUrl(withPlace)).toBe(
      'https://www.google.com/maps/search/?api=1&query=-22.906847%2C-43.172897&query_place_id=ChIJ%20a%2Fb'
    )
    expect(buildGoogleMapsUrl(withPlace, 'directions')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-22.906847%2C-43.172897&destination_place_id=ChIJ%20a%2Fb'
    )
  })

  it('rejects an unknown mode', () => {
    expect(() => buildGoogleMapsUrl(church, 'bogus' as never)).toThrow(RangeError)
    expect(() => buildGoogleMapsUrl(church, 'bogus' as never)).toThrow('Modo de URL inválido: bogus')
  })

  it('ignores an empty place id', () => {
    expect(buildGoogleMapsUrl({ ...church, googlePlaceId: '' })).not.toContain('place_id')
  })

  it('accepts the coordinate range limits', () => {
    expect(buildGoogleMapsUrl({ ...church, latitude: 90, longitude: 180 })).toContain('query=90.000000%2C180.000000')
    expect(buildGoogleMapsUrl({ ...church, latitude: -90, longitude: -180 })).toContain('query=-90.000000%2C-180.000000')
  })

  it.each([
    ['latitude above 90', { latitude: 90.000001 }, 'Latitude inválida'],
    ['latitude below -90', { latitude: -90.000001 }, 'Latitude inválida'],
    ['NaN latitude', { latitude: Number.NaN }, 'Latitude inválida'],
    ['longitude above 180', { longitude: 180.000001 }, 'Longitude inválida'],
    ['longitude below -180', { longitude: -180.000001 }, 'Longitude inválida'],
    ['infinite longitude', { longitude: Number.POSITIVE_INFINITY }, 'Longitude inválida'],
  ])('rejects %s', (_label, override, message) => {
    expect(() => buildGoogleMapsUrl({ ...church, ...override })).toThrow(RangeError)
    expect(() => buildGoogleMapsUrl({ ...church, ...override })).toThrow(message)
  })
})

describe('formatDistancePtBr', () => {
  it.each([
    [0, '0 m'],
    [0.0004, '0 m'],
    [0.45, '450 m'],
    [0.4567, '457 m'],
    [0.999, '999 m'],
    [0.9995, '1,0 km'],
    [1, '1,0 km'],
    [1.42, '1,4 km'],
    [1.46, '1,5 km'],
    [12, '12,0 km'],
    [1234.5, '1.234,5 km'],
  ])('formats %s km as %s', (km, expected) => {
    expect(formatDistancePtBr(km)).toBe(expected)
  })

  it.each([-0.001, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', (km) => {
    expect(() => formatDistancePtBr(km)).toThrow(RangeError)
    expect(() => formatDistancePtBr(km)).toThrow('Distância inválida')
  })
})
