import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import styles from './css/CookieConsentBanner.module.css';
import { useAnalyticsConsent } from '../analytics/consentContext';
import { isPrerendering } from '../analytics/environment';

/**
 * Asks once, with "Aceitar" and "Recusar" equally easy; reopened from the footer to change the choice.
 * Never part of the prerendered HTML: it appears only after the app has started in the browser.
 */
function CookieConsentBanner() {
    // Fixed rather than useId(), which differs between the client prerender and hydration (React #418).
    const titleId = 'cookie-banner-title';
    const { consent, preferencesOpen, closePreferences, accept, reject } = useAnalyticsConsent();
    const bannerRef = useRef<HTMLElement>(null);

    // While hydrating, useConsent reports 'unknown' (its server snapshot), so the first client render
    // matches the static HTML; the prerender itself is excluded by its injected flag.
    const visible = !isPrerendering() && (consent === 'unset' || preferencesOpen);

    // Esc closes the banner when it was reopened to change a choice (closing what is not open does nothing).
    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closePreferences();
            }
        };
        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [closePreferences]);

    // While open, the page keeps room for it at the bottom: nothing (a form's button, the footer)
    // ends up stuck underneath, out of reach until the visitor chooses.
    useEffect(() => {
        const banner = bannerRef.current;
        if (banner === null) {
            return;
        }
        const reserveRoom = () => document.body.style.setProperty('padding-bottom', `${banner.offsetHeight}px`);
        reserveRoom();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reserveRoom);
        observer?.observe(banner);
        return () => {
            observer?.disconnect();
            document.body.style.removeProperty('padding-bottom');
        };
    }, [visible]);

    if (!visible) {
        return null;
    }

    // Reopened to change a choice: the buttons say which one is in force.
    const showsChoice = preferencesOpen && consent !== 'unset';

    return (
        <section ref={bannerRef} className={styles.banner} aria-labelledby={titleId}>
            <div className={styles.inner}>
                <div className={styles.text}>
                    <h2 id={titleId} className={styles.title}>Cookies neste site</h2>
                    <p className={styles.description}>
                        {/* One string, trailing space included: adjacent text nodes would not survive prerendering. */}
                        {'Usamos cookies próprios para entender quais páginas e artigos são lidos, e por quanto tempo, ' +
                            'para melhorar o conteúdo. Eles só são ativados se você aceitar. Você pode mudar sua escolha a ' +
                            'qualquer momento em “Preferências de cookies”, no rodapé. '}
                        <Link className={styles.link} to="/privacidade">Política de privacidade</Link>
                    </p>
                </div>
                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.button}
                        aria-pressed={showsChoice ? consent === 'granted' : undefined}
                        onClick={accept}
                    >
                        Aceitar
                    </button>
                    <button
                        type="button"
                        className={styles.button}
                        aria-pressed={showsChoice ? consent === 'denied' : undefined}
                        onClick={() => void reject()}
                    >
                        Recusar
                    </button>
                </div>
            </div>
        </section>
    );
}

export default CookieConsentBanner;
