// The running analytics for this page load: one session, one queue. Started only with consent
// (by AnalyticsConsentProvider), stopped when consent is withdrawn; `track` is a no-op otherwise.
import { AnalyticsEvent, AnalyticsPayload, revokeConsent, sendEvents, startSession } from './client';
import { isAutomatedBrowser, isPrerendering } from './environment';
import { EventQueue } from './queue';

const MAX_PATH = 2048;
const MAX_TITLE = 512;
const MAX_PAYLOAD_KEYS = 20;
const MAX_PAYLOAD_TEXT = 512;
const MAX_DURATION_MS = 86_400_000;

let queue: EventQueue | null = null;

// Registered only while `queue` exists (startAnalytics / stopAnalytics), hence the plain `?.` guard.
const flushOnLeave = () => {
    if (document.visibilityState === 'hidden') {
        // Stryker disable next-line OptionalChaining: only listening while the queue exists
        void queue?.flush(true);
    }
};
// Stryker disable next-line OptionalChaining: only listening while the queue exists
const flushOnUnload = () => void queue?.flush(true);

/** Whether this environment may be tracked at all (never the prerender, never a bot). */
export function canTrack(): boolean {
    return !isPrerendering() && !isAutomatedBrowser();
}

/** Opens the session (sets the cookies) and starts collecting. Idempotent within a page load. */
export function startAnalytics(): void {
    if (queue !== null || !canTrack()) {
        return;
    }
    const session = startSession({
        landingPath: window.location.pathname,
        referrer: document.referrer,
        search: window.location.search,
    });
    queue = new EventQueue(sendEvents, session);
    document.addEventListener('visibilitychange', flushOnLeave);
    window.addEventListener('pagehide', flushOnUnload);
}

/** Stops collecting and drops anything not yet sent. */
export function stopAnalytics(): void {
    queue?.clear();
    queue = null;
    document.removeEventListener('visibilitychange', flushOnLeave);
    window.removeEventListener('pagehide', flushOnUnload);
}

/** Stops, then asks the backend to clear the cookies and erase this visitor's data. */
export async function withdrawAnalytics(): Promise<void> {
    stopAnalytics();
    await revokeConsent();
}

/** Sends what is queued now, with keepalive: for events recorded as the page goes away. */
export function flushAnalytics(): void {
    void queue?.flush(true);
}

export function isAnalyticsRunning(): boolean {
    return queue !== null;
}

const clip = (text: string, max: number) => text.slice(0, max);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));

function cleanPayload(payload: AnalyticsPayload): AnalyticsPayload {
    const entries = Object.entries(payload)
        .slice(0, MAX_PAYLOAD_KEYS)
        .map(([key, value]): [string, AnalyticsPayload[string]] => [
            clip(key, MAX_PAYLOAD_TEXT),
            typeof value === 'string' ? clip(value, MAX_PAYLOAD_TEXT) : value,
        ]);
    return Object.fromEntries(entries);
}

/** Fits an event to the backend's schema, so one bad field never costs the whole batch. */
export function cleanEvent(event: AnalyticsEvent): AnalyticsEvent {
    const cleaned: AnalyticsEvent = { eventType: event.eventType, path: clip(event.path || '/', MAX_PATH) };
    if (event.title) cleaned.title = clip(event.title, MAX_TITLE);
    if (event.referrer) cleaned.referrer = clip(event.referrer, MAX_PATH);
    if (event.durationMs !== undefined) cleaned.durationMs = clamp(event.durationMs, 0, MAX_DURATION_MS);
    if (event.scrollDepth !== undefined) cleaned.scrollDepth = clamp(event.scrollDepth, 0, 100);
    if (event.payload) cleaned.payload = cleanPayload(event.payload);
    return cleaned;
}

/** Records an event if analytics is running (consent given); otherwise nothing happens. */
export function track(event: AnalyticsEvent): void {
    queue?.enqueue(cleanEvent(event));
}
