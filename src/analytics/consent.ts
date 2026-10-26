// The `ed_consent` cookie, in the exact format the backend reads
// (EvangelismoDigitalBackend: src/common/plugins/cookies/consent.ts).
// The frontend is the only writer; the API reads it and clears it on revocation.

export const CONSENT_COOKIE = 'ed_consent';

/** Must match the backend's CONSENT_VERSION: bumping it asks everyone again. */
export const CONSENT_VERSION = 'v1';

/** 12 months, the backend's CONSENT_MAX_AGE. */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** `unset`: no choice yet (or one made under an older version), so the banner asks. */
export type ConsentState = 'unset' | 'granted' | 'denied';

/** `v1:analytics=1,marketing=0`. The site has no marketing, so that category is always refused. */
export function serializeConsent(analytics: boolean): string {
    return `${CONSENT_VERSION}:analytics=${analytics ? 1 : 0},marketing=0`;
}

/**
 * Same rule as the backend: only the exact token `analytics=1` grants. Unlike the backend, which needs
 * no distinction, a missing value or another version is `unset` so the banner asks; any other `v1`
 * value is a refusal.
 */
export function parseConsent(raw: string | null | undefined): ConsentState {
    const prefix = `${CONSENT_VERSION}:`;
    if (!raw?.startsWith(prefix)) {
        return 'unset';
    }
    const tokens = new Set(raw.slice(prefix.length).split(',').map((token) => token.trim()));
    return tokens.has('analytics=1') ? 'granted' : 'denied';
}

/** The raw value of one cookie, or null. Values are written unencoded, but a percent-encoded one is read too. */
export function readCookie(cookieHeader: string, name: string): string | null {
    for (const part of cookieHeader.split(';')) {
        const separator = part.indexOf('=');
        if (separator !== -1 && part.slice(0, separator).trim() === name) {
            const value = part.slice(separator + 1).trim();
            try {
                return decodeURIComponent(value);
            } catch {
                return value;
            }
        }
    }
    return null;
}

export function readConsent(): ConsentState {
    return parseConsent(readCookie(document.cookie, CONSENT_COOKIE));
}

/** Host-only, site-wide, readable by the page (it carries no identifier); `Secure` whenever served over HTTPS. */
export function consentCookieString(analytics: boolean, secure: boolean): string {
    const attributes = [`Max-Age=${CONSENT_MAX_AGE_SECONDS}`, 'Path=/', 'SameSite=Lax'];
    if (secure) {
        attributes.push('Secure');
    }
    return `${CONSENT_COOKIE}=${serializeConsent(analytics)}; ${attributes.join('; ')}`;
}

const listeners = new Set<() => void>();

/** Same-tab updates come from {@link writeConsent}; a choice made in another tab is picked up on return. */
export function subscribeConsent(listener: () => void): () => void {
    listeners.add(listener);
    // Adding the same listener again is a no-op, so no "first subscriber" bookkeeping is needed.
    document.addEventListener('visibilitychange', notifyConsentListeners);
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            document.removeEventListener('visibilitychange', notifyConsentListeners);
        }
    };
}

export function notifyConsentListeners(): void {
    listeners.forEach((listener) => listener());
}

export function writeConsent(analytics: boolean): void {
    document.cookie = consentCookieString(analytics, window.location.protocol === 'https:');
    notifyConsentListeners();
}

/**
 * The choice to act on. A stored choice always wins (a visitor may opt in explicitly); without one,
 * a browser's Global Privacy Control signal counts as "Recusar", so the banner is not shown.
 */
export function effectiveConsent(stored: ConsentState, globalPrivacyControl: boolean): ConsentState {
    return stored === 'unset' && globalPrivacyControl ? 'denied' : stored;
}

export function hasGlobalPrivacyControl(): boolean {
    return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}
