// Calls to the backend's /analytics routes, always same-origin: the vercel.json route (or the Vite
// proxy in development) adds the secret header, so the browser never knows it.

/** The backend's event types (src/modules/analytics/dto/track-event.dto.ts). */
export type AnalyticsEventType =
    | 'page_view'
    | 'page_exit'
    | 'click'
    | 'form_start'
    | 'form_submit'
    | 'scroll_depth'
    | 'search'
    | 'outbound_click';

export type AnalyticsPayload = Record<string, string | number | boolean | null>;

/** No `occurredAt`: the server stamps the time. */
export interface AnalyticsEvent {
    eventType: AnalyticsEventType;
    path: string;
    title?: string;
    referrer?: string;
    durationMs?: number;
    scrollDepth?: number;
    payload?: AnalyticsPayload;
}

export const ANALYTICS_BASE_PATH = '/analytics';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

/** The campaign parameters of the landing URL, and nothing else from it: the backend reads them from the query. */
export function utmQuery(search: string): string {
    const landing = new URLSearchParams(search);
    const utm = new URLSearchParams();
    for (const key of UTM_KEYS) {
        const value = landing.get(key);
        if (value) {
            utm.set(key, value);
        }
    }
    const query = utm.toString();
    return query ? `?${query}` : '';
}

/**
 * POSTs JSON (the only body type the backend parses). `keepalive` lets a send started while the page
 * unloads still arrive. Resolves `false` instead of throwing: analytics must never break the page.
 */
async function postJson(path: string, body: unknown, keepalive: boolean): Promise<boolean> {
    try {
        const response = await fetch(`${ANALYTICS_BASE_PATH}${path}`, {
            method: 'POST',
            credentials: 'same-origin',
            keepalive,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return response.ok;
    } catch {
        return false;
    }
}

export interface SessionStart {
    landingPath: string;
    referrer: string;
    search: string;
}

/** The only call that creates the visitor and session cookies; the backend does nothing without consent. */
export function startSession({ landingPath, referrer, search }: SessionStart): Promise<boolean> {
    return postJson(`/session${utmQuery(search)}`, { landingPath, referrer: referrer || null }, false);
}

export function sendEvents(events: AnalyticsEvent[], keepalive: boolean): Promise<boolean> {
    return postJson('/events', { events }, keepalive);
}

/** Clears the three cookies, then erases what was collected about this visitor. */
export function revokeConsent(): Promise<boolean> {
    return postJson('/consent/revoke', {}, true);
}
