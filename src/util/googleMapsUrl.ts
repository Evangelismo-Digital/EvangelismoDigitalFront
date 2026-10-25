// Builds official Google Maps URLs (api=1) and pt-BR distance labels for the church list.
// Spec: https://developers.google.com/maps/documentation/urls/get-started

/** One church as returned by the backend's GET /churches/nearest. */
export interface PublicNearbyChurch {
    publicId: string;
    name: string;
    address: string | null;
    lat: number;
    lon: number;
    distanceKm: number;
    distanceMeters: number;
}

export interface ChurchItem {
    id: string;
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
    distanceKm: number;
    googlePlaceId?: string;
}

/** A point in decimal degrees, named like {@link ChurchItem}'s coordinates. */
export interface Coordinates {
    latitude: number;
    longitude: number;
}

export type GoogleMapsUrlMode = 'exact-point' | 'directions';

/** Google Maps URLs `travelmode` for directions. */
export type GoogleTravelMode = 'walking' | 'driving';

const SEARCH_URL = 'https://www.google.com/maps/search/?api=1';
const DIRECTIONS_URL = 'https://www.google.com/maps/dir/?api=1';
const URL_COORDINATE_DECIMALS = 6;

const kmFormatter = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

export function toChurchItem(church: PublicNearbyChurch): ChurchItem {
    return {
        id: church.publicId,
        name: church.name,
        address: church.address,
        latitude: church.lat,
        longitude: church.lon,
        distanceKm: church.distanceKm,
    };
}

function assertValidCoordinates(latitude: number, longitude: number): void {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        throw new RangeError(`Latitude inválida: ${latitude}`);
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw new RangeError(`Longitude inválida: ${longitude}`);
    }
}

/** `LAT%2CLNG` with fixed decimals, dot notation and no spaces. */
function encodeCoordinates(latitude: number, longitude: number): string {
    assertValidCoordinates(latitude, longitude);
    return `${latitude.toFixed(URL_COORDINATE_DECIMALS)}%2C${longitude.toFixed(URL_COORDINATE_DECIMALS)}`;
}

/**
 * Directions start at `origin` (the searched CEP) when given; without one Google Maps starts from the
 * device's own location, which can be far from the CEP the person searched.
 */
export function buildGoogleMapsUrl(
    church: ChurchItem,
    mode: GoogleMapsUrlMode = 'exact-point',
    travelMode?: GoogleTravelMode,
    origin?: Coordinates | null,
): string {
    const coordinates = encodeCoordinates(church.latitude, church.longitude);
    const placeId = church.googlePlaceId ? encodeURIComponent(church.googlePlaceId) : null;

    if (mode === 'exact-point') {
        const url = `${SEARCH_URL}&query=${coordinates}`;
        return placeId ? `${url}&query_place_id=${placeId}` : url;
    }
    if (mode === 'directions') {
        const url = DIRECTIONS_URL
            + (origin ? `&origin=${encodeCoordinates(origin.latitude, origin.longitude)}` : '')
            + `&destination=${coordinates}`
            + (placeId ? `&destination_place_id=${placeId}` : '')
            + (travelMode ? `&travelmode=${travelMode}` : '');
        return url;
    }
    throw new RangeError(`Modo de URL inválido: ${String(mode)}`);
}

/** `450 m` below 1 km, `1,4 km` from 1 km on. */
export function formatDistancePtBr(distanceKm: number): string {
    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
        throw new RangeError(`Distância inválida: ${distanceKm}`);
    }

    const meters = Math.round(distanceKm * 1000);
    if (meters < 1000) {
        return `${meters} m`;
    }
    return `${kmFormatter.format(distanceKm)} km`;
}
