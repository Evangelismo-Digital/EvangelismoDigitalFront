/** Base URL of the backend under test; defaults to the local dev server. */
export const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3333'

export interface RawResponse {
  status: number
  body: unknown
  ms: number
}

/** GET `/churches/nearest` with an arbitrary query string, returning the raw status and JSON. */
export async function getNearest(query: string): Promise<RawResponse> {
  const started = performance.now()
  const response = await fetch(`${API_BASE_URL}/churches/nearest?${query}`, { headers: { Accept: 'application/json' } })
  const body: unknown = await response.json().catch(() => null)
  return { status: response.status, body, ms: performance.now() - started }
}

export async function assertBackendIsUp(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/churches/nearest?cep=00000000`, { signal: AbortSignal.timeout(10_000) })
  } catch (error) {
    throw new Error(
      `Backend not reachable at ${API_BASE_URL}. Start it (EvangelismoDigitalBackend: docker compose up -d && npm run dev) ` +
      `or set API_BASE_URL. Cause: ${String(error)}`
    )
  }
}

/** Real CEPs used by the suites, chosen around the seeded churches (Niterói and Rio de Janeiro). */
export const CEPS = {
  niteroiCentro: '24020085',
  icarai: '24230100',
  rioCentro: '20031050',
  saoPaulo: '01310100',
  inexistent: '00000000',
  /** Well-formed but nonexistent; one geocoder used to place it in Paraná, which the backend now rejects. */
  fakeCep: '99999999',
} as const
