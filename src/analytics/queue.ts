import { AnalyticsEvent } from './client';

/** The backend accepts 1–50 events per request. */
export const MAX_EVENTS_PER_BATCH = 50;

/** Below the backend's 16 KiB body limit, with room for the `{"events":[...]}` wrapper. */
export const MAX_BATCH_BYTES = 15 * 1024;

export const FLUSH_INTERVAL_MS = 10_000;

const encoder = new TextEncoder();

const byteLength = (value: unknown) => encoder.encode(JSON.stringify(value)).length;

/**
 * Splits events into request bodies the backend accepts: at most 50 events and {@link MAX_BATCH_BYTES}
 * (UTF-8, as titles carry accents) each. An event too large to ever fit is dropped.
 */
export function toBatches(events: AnalyticsEvent[]): AnalyticsEvent[][] {
    const batches: AnalyticsEvent[][] = [];
    let batch: AnalyticsEvent[] = [];

    for (const event of events) {
        if (byteLength({ events: [event] }) > MAX_BATCH_BYTES) {
            continue;
        }
        const candidate = [...batch, event];
        if (candidate.length > MAX_EVENTS_PER_BATCH || byteLength({ events: candidate }) > MAX_BATCH_BYTES) {
            batches.push(batch);
            batch = [event];
        } else {
            batch = candidate;
        }
    }
    if (batch.length > 0) {
        batches.push(batch);
    }
    return batches;
}

export type SendEvents = (events: AnalyticsEvent[], keepalive: boolean) => Promise<boolean>;

/**
 * Collects events and sends them in batches: every {@link FLUSH_INTERVAL_MS}, and right away when the
 * page is hidden or unloads. Nothing is sent before `ready` (the session that sets the cookies) settles.
 * A batch that fails is tried once more with the next flush, then dropped: no event is kept on disk.
 */
export class EventQueue {
    private pending: AnalyticsEvent[] = [];
    private retry: AnalyticsEvent[] = [];
    private timer: ReturnType<typeof setInterval> | null = null;
    private sessionReady = false;

    constructor(
        private readonly send: SendEvents,
        ready: Promise<unknown>,
    ) {
        void ready.then(() => {
            this.sessionReady = true;
        });
    }

    enqueue(event: AnalyticsEvent): void {
        this.pending.push(event);
        this.timer ??= setInterval(() => void this.flush(false), FLUSH_INTERVAL_MS);
    }

    /** `keepalive` for flushes made while the page goes away. */
    async flush(keepalive: boolean): Promise<void> {
        if (!this.sessionReady) {
            return;
        }
        const retried = this.retry;
        const fresh = this.pending;
        this.retry = [];
        this.pending = [];

        for (const batch of toBatches([...retried, ...fresh])) {
            const sent = await this.send(batch, keepalive);
            if (!sent) {
                // Only events on their first attempt get a second one.
                this.retry.push(...batch.filter((event) => fresh.includes(event)));
            }
        }
    }

    /** Drops everything and stops the timer (consent withdrawn). */
    clear(): void {
        this.pending = [];
        this.retry = [];
        clearInterval(this.timer ?? undefined);
        this.timer = null;
    }
}
