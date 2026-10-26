import { render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { useAnalyticsConsent } from './consentContext'
import useConsent from './useConsent'

function ShowConsent() {
  return <p>{useConsent()}</p>
}

function NeedsProvider() {
  useAnalyticsConsent()
  return null
}

describe('useConsent', () => {
  it('is "unknown" in the server/prerender render, so nothing consent-dependent is in static HTML', () => {
    expect(renderToString(<ShowConsent />)).toBe('<p>unknown</p>')
  })

  it('is the stored choice in the browser', () => {
    render(<ShowConsent />)

    expect(screen.getByText('unset')).toBeInTheDocument()
  })
})

describe('useAnalyticsConsent', () => {
  it('fails loudly outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<NeedsProvider />)).toThrow('useAnalyticsConsent must be used inside AnalyticsConsentProvider')
  })
})
