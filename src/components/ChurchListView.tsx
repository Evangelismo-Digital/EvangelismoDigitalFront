import { useId } from 'react';
import styles from './css/ChurchListView.module.css';
import { ChurchItem, Coordinates, buildGoogleMapsUrl, formatDistancePtBr } from '../util/googleMapsUrl';
import { MAX_CHURCHES, formatCep } from '../util/nearestChurchesApi';
import { TRAVEL_MODES, TravelMode } from '../util/travelMode';

export const MISSING_ADDRESS_TEXT = 'Endereço não informado — toque para ver no mapa.';

interface ChurchListViewProps {
    userCep: string;
    mode: TravelMode;
    churches: ChurchItem[];
    /** The searched CEP's point, where "Como chegar" starts; `null` leaves it to the device's location. */
    origin?: Coordinates | null;
}

const PinIcon = () => (
    <svg className={styles.addressIcon} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
        <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
);

const ExternalIcon = () => (
    <svg className={styles.icon} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
        <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const DirectionsIcon = () => (
    <svg className={styles.icon} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
        <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/** The nearest churches drawn as stops on a route that starts at the searched CEP. */
function ChurchListView({ userCep, mode, churches, origin = null }: ChurchListViewProps) {
    const headingId = useId();
    const travel = TRAVEL_MODES[mode];
    const visibleChurches = churches.slice(0, MAX_CHURCHES);

    return (
        <section className={styles.directory} aria-labelledby={headingId}>
            <h2 id={headingId} className={styles.heading}>Igrejas mais próximas</h2>

            <div className={styles.route}>
                <p className={styles.origin}>
                    <span className={styles.originMarker} aria-hidden="true" />
                    CEP {formatCep(userCep)}
                </p>

                <ol className={styles.stops}>
                    {visibleChurches.map((church, index) => {
                        const rank = index + 1;
                        const isNearest = index === 0;
                        const distance = `${formatDistancePtBr(church.distanceKm)} ${travel.distanceSuffix}`;
                        const address = church.address ?? MISSING_ADDRESS_TEXT;

                        return (
                            <li key={church.id} className={isNearest ? `${styles.stop} ${styles.stopNearest}` : styles.stop}>
                                <span className={styles.stopMarker} aria-hidden="true" />
                                <div className={styles.stopBody}>
                                    <p className={styles.meta}>
                                        <span className={styles.distance}>{distance}</span>
                                        {isNearest && <span className={styles.nearestTag}>Mais próxima</span>}
                                    </p>
                                    <h3 className={styles.name}>{church.name}</h3>
                                    <p className={styles.address}>
                                        <PinIcon />
                                        <span>{address}</span>
                                    </p>
                                    <div className={styles.actions}>
                                        <a
                                            className={styles.mapLink}
                                            href={buildGoogleMapsUrl(church, 'exact-point')}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={`${rank}ª igreja: ${church.name}, a ${distance}. ${address} Ver no Google Maps (abre em nova aba).`}
                                        >
                                            <ExternalIcon />
                                            Ver no Google Maps
                                        </a>
                                        <a
                                            className={styles.directionsLink}
                                            href={buildGoogleMapsUrl(church, 'directions', travel.googleTravelMode, origin)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={`Como chegar a ${church.name} ${travel.distanceSuffix} pelo Google Maps (abre em nova aba).`}
                                        >
                                            <DirectionsIcon />
                                            Como chegar
                                        </a>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </section>
    );
}

export default ChurchListView;
