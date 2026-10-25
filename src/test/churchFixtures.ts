import type { PublicNearbyChurch } from '../util/googleMapsUrl'

export const backendChurch = (overrides: Partial<PublicNearbyChurch> = {}): PublicNearbyChurch => ({
  publicId: 'church-1',
  name: 'Igreja Batista Central',
  address: 'R. da Conceição, 100 - Centro, Niterói - RJ',
  lat: -22.894623,
  lon: -43.123987,
  distanceKm: 0.45,
  distanceMeters: 450,
  ...overrides,
})

export const fiveBackendChurches = (): PublicNearbyChurch[] => [
  backendChurch(),
  backendChurch({ publicId: 'church-2', name: 'Igreja Presbiteriana Icaraí', address: 'R. Gavião Peixoto, 50 - Icaraí, Niterói - RJ', lat: -22.903, lon: -43.108, distanceKm: 1.42, distanceMeters: 1420 }),
  backendChurch({ publicId: 'church-3', name: 'Comunidade Evangélica Ingá', address: null, lat: -22.9081, lon: -43.1275, distanceKm: 2.05, distanceMeters: 2050 }),
  backendChurch({ publicId: 'church-4', name: 'Igreja Metodista São Domingos', lat: -22.8992, lon: -43.1301, distanceKm: 3.4, distanceMeters: 3400 }),
  backendChurch({ publicId: 'church-5', name: 'Assembleia de Deus Fonseca', lat: -22.8811, lon: -43.0998, distanceKm: 4.75, distanceMeters: 4750 }),
]

/** Where the backend says the routes start: the point CEP 24020-085 resolved to. */
export const backendOrigin = { lat: -22.8968, lon: -43.1236 }

export const nearestResponse = (churches: PublicNearbyChurch[] = fiveBackendChurches()) => ({
  nearestChurchesInfo: churches,
  origin: backendOrigin,
  totalFound: churches.length,
  mode: 'pedestrian',
  precision: 'ROOFTOP',
  coordinatesProviderName: 'test',
})

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
