// The site's interaction events. Only coarse facts: never the CEP, an email or what was typed.
import type { AnalyticsEvent } from './client';
import type { TravelMode } from '../util/travelMode';

export type SearchOutcome = 'found' | 'none' | 'error';

/** A church search whose result is known: how the person travels and whether churches were found. */
export function churchSearchEvent(path: string, mode: TravelMode, resultCount: number | null, noChurches: boolean): AnalyticsEvent {
    const outcome: SearchOutcome = resultCount !== null ? 'found' : noChurches ? 'none' : 'error';
    return { eventType: 'search', path, payload: { mode, outcome, resultCount: resultCount ?? 0 } };
}

/** The contact form appears on the home page and under every article. */
export function contactFormName(pathname: string): 'contato-artigo' | 'contato-home' {
    return pathname.startsWith('/artigo/') ? 'contato-artigo' : 'contato-home';
}

export function contactFormStartEvent(pathname: string): AnalyticsEvent {
    return { eventType: 'form_start', path: pathname, payload: { form: contactFormName(pathname) } };
}

export function contactFormSubmitEvent(pathname: string, success: boolean): AnalyticsEvent {
    return {
        eventType: 'form_submit',
        path: pathname,
        payload: { form: contactFormName(pathname), result: success ? 'success' : 'error' },
    };
}
