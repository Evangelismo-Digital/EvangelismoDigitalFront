import { z } from 'zod';
import { API_URL } from '../config/api';
import isErrorResponse from './isErrorResponse';
import { ChurchItem, Coordinates, toChurchItem } from './googleMapsUrl';
import { TravelMode } from './travelMode';

export const MAX_CHURCHES = 5;

export type NearestChurchesErrorKind = 'cep-not-found' | 'no-churches' | 'rate-limited' | 'unavailable';

export const NEAREST_CHURCHES_MESSAGES: Record<NearestChurchesErrorKind, string> = {
    'cep-not-found': 'Não encontramos esse CEP. Confira os números e tente de novo.',
    'no-churches': 'Ainda não temos igrejas cadastradas perto desse CEP.',
    'rate-limited': 'Muitas buscas seguidas. Aguarde um minuto e tente novamente.',
    'unavailable': 'Não foi possível buscar agora. Verifique sua conexão e tente novamente.',
};

const CEP_NOT_FOUND_CODES = new Set(['INVALID_CEP', 'COORDINATES_NOT_FOUND']);
const NO_CHURCHES_CODES = new Set(['NO_NEARBY_CHURCHES_FOUND', 'EMPTY_CHURCH_LIST']);

export class NearestChurchesError extends Error {
    readonly kind: NearestChurchesErrorKind;

    constructor(kind: NearestChurchesErrorKind) {
        super(NEAREST_CHURCHES_MESSAGES[kind]);
        this.name = 'NearestChurchesError';
        this.kind = kind;
    }
}

const churchSchema = z.object({
    publicId: z.string().min(1),
    name: z.string().min(1),
    address: z.string().nullable(),
    lat: z.number().finite().min(-90).max(90),
    lon: z.number().finite().min(-180).max(180),
    distanceKm: z.number().finite().nonnegative(),
    distanceMeters: z.number().finite().nonnegative(),
});

const originSchema = z.object({
    lat: z.number().finite().min(-90).max(90),
    lon: z.number().finite().min(-180).max(180),
});

const responseSchema = z.object({
    nearestChurchesInfo: z.array(z.unknown()),
    origin: z.unknown(),
});

/** The churches, closest first, and the point their routes start from (the searched CEP). */
export interface NearestChurches {
    /** `null` when the backend sends none (or an invalid one): directions then start from the device. */
    origin: Coordinates | null;
    churches: ChurchItem[];
}

function parseOrigin(origin: unknown): Coordinates | null {
    const parsed = originSchema.safeParse(origin);
    return parsed.success ? { latitude: parsed.data.lat, longitude: parsed.data.lon } : null;
}

/** Digits only, as the backend accepts `12345678`. */
export function normalizeCep(cep: string): string {
    return cep.replace(/\D/g, '');
}

/** Input mask: keeps up to 8 digits and adds the hyphen after the fifth (`24020-0`). */
export function maskCep(value: string): string {
    const digits = normalizeCep(value).slice(0, 8);
    return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

/** `24020085` → `24020-085`; anything that is not 8 digits is returned as typed. */
export function formatCep(cep: string): string {
    const digits = normalizeCep(cep);
    return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : cep;
}

function errorKindFor(status: number, body: unknown): NearestChurchesErrorKind {
    if (status === 429) {
        return 'rate-limited';
    }
    if (status === 400) {
        return 'cep-not-found';
    }
    if (status === 404 && isErrorResponse(body)) {
        if (CEP_NOT_FOUND_CODES.has(body.code)) {
            return 'cep-not-found';
        }
        if (NO_CHURCHES_CODES.has(body.code)) {
            return 'no-churches';
        }
    }
    return 'unavailable';
}

/** Keeps only well-formed churches, closest first, at most {@link MAX_CHURCHES}, with the route origin. */
export function parseNearestChurches(body: unknown): NearestChurches {
    const parsed = responseSchema.safeParse(body);
    if (!parsed.success) {
        throw new NearestChurchesError('unavailable');
    }

    const churches = parsed.data.nearestChurchesInfo
        .map((item) => churchSchema.safeParse(item))
        .flatMap((result) => (result.success ? [toChurchItem(result.data)] : []))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, MAX_CHURCHES);

    if (churches.length === 0) {
        throw new NearestChurchesError('no-churches');
    }
    return { origin: parseOrigin(parsed.data.origin), churches };
}

export interface NearestChurchesSearch {
    cep: string;
    mode: TravelMode;
}

export async function fetchNearestChurches(
    { cep, mode }: NearestChurchesSearch,
    signal?: AbortSignal,
    baseUrl: string = API_URL,
): Promise<NearestChurches> {
    const query = new URLSearchParams({ cep: normalizeCep(cep), mode });
    const url = `${baseUrl}/churches/nearest?${query}`;

    let response: Response;
    try {
        response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
    } catch (error) {
        if (signal?.aborted) {
            throw error;
        }
        throw new NearestChurchesError('unavailable');
    }

    // Stryker disable next-line ArrowFunction: null and undefined are both "no usable body" downstream
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
        throw new NearestChurchesError(errorKindFor(response.status, body));
    }
    return parseNearestChurches(body);
}
