import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { flushAnalytics, track } from './analytics';
import type { AnalyticsPayload } from './client';
import { useAnalyticsConsent } from './consentContext';
import { PageReading, articleSlug, scrollDepth } from './reading';

const ARTICLE_SELECTOR = '[data-analytics-article]';

/** A click on a link to another site: only the destination host and the link's `data-analytics` kind. */
function outboundClickPayload(target: EventTarget | null): AnalyticsPayload | null {
    const link = target instanceof Element ? target.closest('a[href]') : null;
    if (!(link instanceof HTMLAnchorElement)) {
        return null;
    }
    const url = new URL(link.href, window.location.href);
    if (!url.protocol.startsWith('http') || url.origin === window.location.origin) {
        return null;
    }
    return { host: url.host, kind: link.dataset.analytics ?? 'link' };
}

/**
 * Page views and reading, once there is consent: `page_view` on arrival, `scroll_depth` milestones
 * on articles, and one `page_exit` per view with the visible reading time and the deepest point read.
 * Renders nothing.
 */
function AnalyticsRouteTracker() {
    const { pathname } = useLocation();
    const { consent } = useAnalyticsConsent();
    const active = consent === 'granted';

    useEffect(() => {
        if (!active) {
            return;
        }
        const slug = articleSlug(pathname);
        const payload: AnalyticsPayload | undefined = slug ? { kind: 'article', slug } : undefined;
        const reading = new PageReading(() => performance.now(), document.visibilityState === 'visible');
        let title: string | undefined;
        let viewed = false;
        let exited = false;
        let measuring = false;

        const measure = () => {
            const article = slug ? document.querySelector(ARTICLE_SELECTOR) : null;
            if (slug && !article) {
                return; // still loading: the page around it is not the article
            }
            for (const milestone of reading.recordDepth(scrollDepth(article))) {
                if (slug) {
                    track({ eventType: 'scroll_depth', path: pathname, scrollDepth: milestone, payload });
                }
            }
        };

        // After this frame the page has set its title, and the provider has started analytics.
        const viewFrame = requestAnimationFrame(() => {
            viewed = true;
            title = document.title;
            track({ eventType: 'page_view', path: pathname, title, payload });
            measure();
        });

        const onScroll = () => {
            if (!viewed || measuring) {
                return;
            }
            measuring = true;
            requestAnimationFrame(() => {
                measuring = false;
                measure();
            });
        };
        const onVisibility = () => reading.setVisible(document.visibilityState === 'visible');
        const exit = () => {
            if (!viewed || exited) {
                return;
            }
            exited = true;
            measure();
            track({
                eventType: 'page_exit',
                path: pathname,
                title,
                durationMs: reading.durationMs(),
                scrollDepth: reading.maxDepth(),
                payload,
            });
        };
        const onPageHide = () => {
            exit();
            flushAnalytics();
        };
        const onClick = (event: MouseEvent) => {
            const outbound = outboundClickPayload(event.target);
            if (outbound) {
                track({ eventType: 'outbound_click', path: pathname, payload: outbound });
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pagehide', onPageHide);
        document.addEventListener('click', onClick, { capture: true });

        return () => {
            cancelAnimationFrame(viewFrame);
            window.removeEventListener('scroll', onScroll);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('pagehide', onPageHide);
            document.removeEventListener('click', onClick, { capture: true });
            exit();
        };
    }, [pathname, active]);

    return null;
}

export default AnalyticsRouteTracker;
