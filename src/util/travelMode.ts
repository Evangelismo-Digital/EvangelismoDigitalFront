/** How the person travels to the church; the values are the backend's `?mode=` contract. */
export type TravelMode = 'pedestrian' | 'transport';

export const DEFAULT_TRAVEL_MODE: TravelMode = 'pedestrian';

interface TravelModeCopy {
    /** Option in the "Como você vai até a igreja?" switch. */
    option: string;
    /** Appended to a distance: `450 m a pé`. */
    distanceSuffix: string;
    /** Google Maps URLs `travelmode` for the directions link. */
    googleTravelMode: 'walking' | 'driving';
}

export const TRAVEL_MODES: Record<TravelMode, TravelModeCopy> = {
    pedestrian: { option: 'A pé', distanceSuffix: 'a pé', googleTravelMode: 'walking' },
    transport: { option: 'De carro', distanceSuffix: 'de carro', googleTravelMode: 'driving' },
};

export function isTravelMode(value: unknown): value is TravelMode {
    return value === 'pedestrian' || value === 'transport';
}
