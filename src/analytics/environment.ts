// Where analytics must stay off: the Puppeteer prerender (vite.config.ts injects the flag) and
// automated browsers, except our own E2E runs, which opt in explicitly.

interface AnalyticsWindow {
    __PRERENDER_INJECTED?: { prerendering?: boolean };
    __ANALYTICS_E2E__?: boolean;
}

const flags = () => window as unknown as AnalyticsWindow;

/** True while the build renders static HTML: nothing consent-dependent may end up in it. */
export function isPrerendering(): boolean {
    return flags().__PRERENDER_INJECTED?.prerendering === true;
}

/** Bots and test drivers are not readers; the E2E suites set `__ANALYTICS_E2E__` to be tracked anyway. */
export function isAutomatedBrowser(): boolean {
    return navigator.webdriver === true && flags().__ANALYTICS_E2E__ !== true;
}
