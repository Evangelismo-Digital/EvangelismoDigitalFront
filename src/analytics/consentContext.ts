import { createContext, useContext } from 'react';
import type { ConsentView } from './useConsent';

export interface AnalyticsConsentValue {
    consent: ConsentView;
    /** The banner was reopened from the footer to change an earlier choice. */
    preferencesOpen: boolean;
    openPreferences: () => void;
    closePreferences: () => void;
    accept: () => void;
    reject: () => Promise<void>;
}

export const AnalyticsConsentContext = createContext<AnalyticsConsentValue | null>(null);

export function useAnalyticsConsent(): AnalyticsConsentValue {
    const value = useContext(AnalyticsConsentContext);
    if (value === null) {
        throw new Error('useAnalyticsConsent must be used inside AnalyticsConsentProvider');
    }
    return value;
}
