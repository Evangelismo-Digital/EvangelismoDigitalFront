import { useSyncExternalStore } from 'react';
import { ConsentState, effectiveConsent, hasGlobalPrivacyControl, readConsent, subscribeConsent } from './consent';

/** `unknown` while prerendering/hydrating: nothing that depends on consent is rendered into static HTML. */
export type ConsentView = ConsentState | 'unknown';

const getSnapshot = (): ConsentView => effectiveConsent(readConsent(), hasGlobalPrivacyControl());
const getServerSnapshot = (): ConsentView => 'unknown';

/** The visitor's current choice, re-read whenever it changes (in this tab or, on return, in another). */
function useConsent(): ConsentView {
    return useSyncExternalStore(subscribeConsent, getSnapshot, getServerSnapshot);
}

export default useConsent;
