import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { writeConsent } from './consent';
import { AnalyticsConsentContext, AnalyticsConsentValue } from './consentContext';
import { startAnalytics, stopAnalytics, withdrawAnalytics } from './analytics';
import useConsent from './useConsent';

/** Owns the visitor's choice: starts analytics when it is "Aceitar", stops (and revokes) otherwise. */
function AnalyticsConsentProvider({ children }: { children: ReactNode }) {
    const consent = useConsent();
    const [preferencesOpen, setPreferencesOpen] = useState(false);

    useEffect(() => {
        // Anything but a grant stops it (a no-op before hydration, when nothing runs yet).
        if (consent === 'granted') {
            startAnalytics();
        } else {
            stopAnalytics();
        }
    }, [consent]);

    const reject = useCallback(async () => {
        setPreferencesOpen(false);
        if (consent === 'granted') {
            // The backend clears all three cookies (ed_consent included) before erasing the data,
            // so the refusal is written only after it answers, or the clear would erase it.
            await withdrawAnalytics();
        }
        writeConsent(false);
    }, [consent]);

    const value = useMemo<AnalyticsConsentValue>(() => ({
        consent,
        preferencesOpen,
        openPreferences: () => setPreferencesOpen(true),
        closePreferences: () => setPreferencesOpen(false),
        accept: () => {
            setPreferencesOpen(false);
            writeConsent(true);
        },
        reject,
    }), [consent, preferencesOpen, reject]);

    return <AnalyticsConsentContext.Provider value={value}>{children}</AnalyticsConsentContext.Provider>;
}

export default AnalyticsConsentProvider;
