import { ComponentType, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import styles from './css/FindNearestChurch.module.css';
import ChurchListView from './ChurchListView';
import ChurchRouteIllustration from './ChurchRouteIllustration';
import { CarIcon, MailIcon, PinIcon, SearchIcon, WalkIcon } from './FindNearestChurchIcons';
import { useQueryClient } from '@tanstack/react-query';
import useNearestChurches, { nearestChurchesQueryKey } from '../hook/useNearestChurches';
import {
    NEAREST_CHURCHES_MESSAGES,
    NearestChurchesError,
    NearestChurchesSearch,
    maskCep,
} from '../util/nearestChurchesApi';
import { ChurchSearchData, ChurchSearchInput, churchSearchSchema } from '../util/churchSearchSchema';
import { sendChurchSearchLead } from '../util/churchSearchLead';
import { track } from '../analytics/analytics';
import { churchSearchEvent } from '../analytics/events';
import { DEFAULT_TRAVEL_MODE, TRAVEL_MODES, TravelMode, isTravelMode } from '../util/travelMode';

export const NO_CHURCHES_WALKING_MESSAGE = 'Nenhuma igreja a até 10 km a pé desse CEP.';

export const CORREIOS_CEP_SEARCH_URL = 'https://buscacepinter.correios.com.br/app/endereco/index.php';

const RETRYABLE_ERRORS = new Set<NearestChurchesError['kind']>(['rate-limited', 'unavailable']);

const MODE_OPTIONS: TravelMode[] = ['pedestrian', 'transport'];

const MODE_ICONS: Record<TravelMode, ComponentType> = { pedestrian: WalkIcon, transport: CarIcon };

function FindNearestChurch() {
    const queryClient = useQueryClient();
    // A fixed id, not useId(): the prerender is a client render and visitors hydrate it, and React's client
    // and hydration useId values differ, which would break hydration (React #418). One search per page.
    const fieldId = 'find-church';
    const cepHintId = `${fieldId}-cep-hint`;
    const cepErrorId = `${fieldId}-cep-error`;
    const emailNoticeId = `${fieldId}-email-notice`;
    const emailErrorId = `${fieldId}-email-error`;
    const [search, setSearch] = useState<NearestChurchesSearch | null>(null);
    // The email given with the last submitted search, reused when that search is repeated by car or on foot.
    // Stryker disable next-line StringLiteral: never read before a submit sets it, as every search starts with one
    const searchEmail = useRef('');
    // The search still to be reported to the team, once its result is known.
    const pendingLead = useRef<(NearestChurchesSearch & { email: string }) | null>(null);
    // Counts searches, so repeating one already on screen is reported (and scrolled to) too.
    const [searchCount, setSearchCount] = useState(0);
    const resultsRef = useRef<HTMLDivElement>(null);
    const nearest = useNearestChurches(search);
    // A failed query keeps its "error" status while "Tentar novamente" fetches it again, so only an idle error is
    // final. A new search never waits on that state (it restarts from "pending"), which makes this a guard:
    // Stryker disable next-line ConditionalExpression,LogicalOperator: equivalent today, see above
    const resultKnown = nearest.data !== undefined || (nearest.status === 'error' && nearest.fetchStatus === 'idle');

    // Reported from the result on screen rather than a fetch of its own, so the backend is called once.
    useEffect(() => {
        const lead = pendingLead.current;
        if (lead === null || !resultKnown) {
            return;
        }
        pendingLead.current = null;
        sendChurchSearchLead({ ...lead, nearestChurchName: nearest.data?.churches[0].name ?? null })
            .catch((err: unknown) => console.error('Falha ao enviar o contato da busca de igreja:', err));
        // Analytics (only with consent) gets the outcome alone: never the CEP or the email.
        const noChurches = nearest.error instanceof NearestChurchesError && nearest.error.kind === 'no-churches';
        track(churchSearchEvent(window.location.pathname, lead.mode, nearest.data?.churches.length ?? null, noChurches));
    }, [searchCount, resultKnown, nearest.data, nearest.error]);

    // Each search brings its results into view: once while loading, and again once the list (or error) is
    // shown, since near the end of the page a short loading line cannot be scrolled up to the top yet.
    // The CSS scroll margin clears the fixed navbar. A smooth scroll aims once, so it waits for the web fonts:
    // a search made right after the page opens would otherwise be thrown off when they swap in.
    const scrollPending = useRef(false);
    useEffect(() => {
        if (!scrollPending.current) {
            return;
        }
        if (resultKnown) {
            scrollPending.current = false;
        }
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        void Promise.resolve(document.fonts?.ready).then(() => {
            // Stryker disable next-line OptionalChaining: the results area is always rendered, so the ref is always set
            resultsRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        });
    }, [searchCount, resultKnown]);

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors }
    } = useForm<ChurchSearchInput, unknown, ChurchSearchData>({
        resolver: zodResolver(churchSearchSchema),
        mode: 'onBlur',
        defaultValues: { mode: DEFAULT_TRAVEL_MODE },
    });

    // Every search is reported to the team, with the email, once its result is known;
    // a failed search or one that found nothing says no church was found.
    const runSearch = (next: NearestChurchesSearch) => {
        // Searching again after a failure asks the backend again instead of showing the old error.
        const queryKey = nearestChurchesQueryKey(next);
        if (queryClient.getQueryState(queryKey)?.status === 'error') {
            void queryClient.invalidateQueries({ queryKey });
        }
        pendingLead.current = { ...next, email: searchEmail.current };
        scrollPending.current = true;
        setSearch(next);
        // Stryker disable next-line ArithmeticOperator: only a change matters, counting down triggers the report too
        setSearchCount((count) => count + 1);
    };

    const cepField = register('cep');
    // Switching the travel mode after a search repeats it for the same CEP.
    const modeField = register('mode', {
        onChange: (event: { target: { value: unknown } }) => {
            const mode = event.target.value;
            if (search !== null && isTravelMode(mode)) {
                runSearch({ cep: search.cep, mode });
            }
        },
    });

    const onSubmit = ({ mode, cep, email }: ChurchSearchData) => {
        searchEmail.current = email;
        runSearch({ cep, mode });
    };

    const searchByCar = (cep: string) => {
        setValue('mode', 'transport');
        runSearch({ cep, mode: 'transport' });
    };

    // A first-time search; refreshing a saved result in the background is not "searching".
    const isSearching = nearest.data === undefined && nearest.fetchStatus === 'fetching';
    // Anything that is not a mapped backend error (including an offline pause) is shown as "unavailable".
    const errorKind = nearest.error instanceof NearestChurchesError ? nearest.error.kind : 'unavailable';

    const renderResults = () => {
        if (search === null) {
            return null;
        }

        if (isSearching) {
            return (
                <p className={styles.statusText} role="status">
                    <span className={styles.spinner} aria-hidden="true" />
                    Buscando as igrejas mais próximas...
                </p>
            );
        }

        // A saved result stays on screen even if refreshing it fails.
        if (nearest.data) {
            return (
                <ChurchListView
                    userCep={search.cep}
                    mode={search.mode}
                    churches={nearest.data.churches}
                    origin={nearest.data.origin}
                />
            );
        }

        const walkingFoundNothing = errorKind === 'no-churches' && search.mode === 'pedestrian';

        // Failed, or paused because the device is offline (it resumes on reconnect).
        return (
            <div className={styles.errorBox} role="alert">
                <p>{walkingFoundNothing ? NO_CHURCHES_WALKING_MESSAGE : NEAREST_CHURCHES_MESSAGES[errorKind]}</p>
                {walkingFoundNothing && (
                    <button type="button" className={styles.secondaryButton} onClick={() => searchByCar(search.cep)}>
                        <CarIcon />
                        Ver igrejas de carro
                    </button>
                )}
                {RETRYABLE_ERRORS.has(errorKind) && (
                    <button type="button" className={styles.secondaryButton} onClick={() => nearest.refetch()}>
                        Tentar novamente
                    </button>
                )}
            </div>
        );
    };

    return (
        <section className={styles.container}>
            <h1 className={styles.title}>Encontre uma igreja perto de você</h1>
            <p className={styles.lead}>
                digite seu CEP para se conectar com nossa equipe de voluntários e com igrejas perto de você.
            </p>

            {/* After a search the results take the illustration's place: beside the form, or under it on small screens. */}
            <div className={search === null ? styles.card : `${styles.card} ${styles.cardWithResults}`}>
                {search === null && (
                    <div className={styles.art}>
                        <ChurchRouteIllustration className={styles.illustration} />
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
                    <fieldset className={styles.modeSwitch}>
                        <legend className={styles.legend}>Como você vai até a igreja?</legend>
                        <div className={styles.modeOptions}>
                            {MODE_OPTIONS.map((mode) => {
                                const ModeIcon = MODE_ICONS[mode];
                                return (
                                    <label key={mode} className={styles.modeOption}>
                                        <input type="radio" value={mode} className={styles.modeInput} {...modeField} />
                                        <span className={styles.modeLabel}>
                                            <ModeIcon />
                                            {TRAVEL_MODES[mode].option}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor={`${fieldId}-cep`}>CEP</label>
                        <div className={styles.inputWrap}>
                            <PinIcon />
                            <input
                                id={`${fieldId}-cep`}
                                type="text"
                                inputMode="numeric"
                                autoComplete="postal-code"
                                placeholder="00000-000"
                                maxLength={9}
                                className={`${styles.input} ${styles.cepInput}`}
                                aria-required="true"
                                aria-invalid={errors.cep ? true : undefined}
                                aria-describedby={errors.cep ? `${cepHintId} ${cepErrorId}` : cepHintId}
                                {...cepField}
                                onChange={(event) => {
                                    event.target.value = maskCep(event.target.value);
                                    return cepField.onChange(event);
                                }}
                            />
                        </div>
                        <span id={cepHintId} className={styles.notice}>
                            {/* One string with its trailing space: text + {' '} would be two text nodes, which the
                                prerendered HTML merges into one, breaking hydration (React #418). */}
                            {'CEP é o código postal de 8 números do seu endereço, como 24230-100. Não sabe o seu? '}
                            <a
                                className={styles.noticeLink}
                                href={CORREIOS_CEP_SEARCH_URL}
                                data-analytics="correios"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Consulte nos Correios (abre em nova aba)"
                            >
                                Consulte nos Correios
                            </a>
                            .
                        </span>
                        <span id={cepErrorId} className={styles.errorMessage} role={errors.cep ? 'alert' : undefined}>
                            {errors.cep?.message || "\u00A0"}
                        </span>
                    </div>

                    <div className={`${styles.field} ${styles.emailField}`}>
                        <label className={styles.label} htmlFor={`${fieldId}-email`}>Email</label>
                        <div className={styles.inputWrap}>
                            <MailIcon />
                            <input
                                id={`${fieldId}-email`}
                                type="email"
                                autoComplete="email"
                                placeholder="seu@email.com"
                                className={styles.input}
                                aria-required="true"
                                aria-invalid={errors.email ? true : undefined}
                                aria-describedby={errors.email ? `${emailNoticeId} ${emailErrorId}` : emailNoticeId}
                                {...register('email')}
                            />
                        </div>
                        <span id={emailNoticeId} className={styles.notice}>
                            Nossa equipe poderá entrar em contato para ajudar você a conhecer uma igreja.
                        </span>
                        <span id={emailErrorId} className={styles.errorMessage} role={errors.email ? 'alert' : undefined}>
                            {errors.email?.message || "\u00A0"}
                        </span>
                    </div>

                    <button
                        type="submit"
                        className={styles.submitButton}
                        disabled={isSearching}
                    >
                        {isSearching ? <span className={styles.buttonSpinner} aria-hidden="true" /> : <SearchIcon />}
                        {isSearching ? 'Buscando...' : 'Buscar igrejas'}
                    </button>
                </form>

                <div ref={resultsRef} className={styles.resultsSection} aria-live="polite" aria-busy={isSearching}>
                    {renderResults()}
                </div>
            </div>
        </section>
    );
}

export default FindNearestChurch;
