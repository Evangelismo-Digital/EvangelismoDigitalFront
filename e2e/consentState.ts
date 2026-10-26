// Specs that are not about consent start with a refusal already stored, so the cookie banner
// (fixed at the bottom) neither covers what they click nor sends analytics.
// e2e/cookie-consent.spec.ts clears it to test the banner itself.

export const REFUSED_CONSENT = 'v1:analytics=0,marketing=0'
export const GRANTED_CONSENT = 'v1:analytics=1,marketing=0'

export const refusedConsentState = {
  cookies: [
    {
      name: 'ed_consent',
      value: REFUSED_CONSENT,
      domain: 'localhost',
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    },
  ],
  origins: [],
}

export const noConsentState = { cookies: [], origins: [] }
