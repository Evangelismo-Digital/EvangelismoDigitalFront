import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import PrivacyPage from './PrivacyPage'
import { AnalyticsConsentContext, type AnalyticsConsentValue } from '../analytics/consentContext'

const renderPage = () => {
  const openPreferences = vi.fn()
  const value: AnalyticsConsentValue = {
    consent: 'unset',
    preferencesOpen: false,
    openPreferences,
    closePreferences: vi.fn(),
    accept: vi.fn(),
    reject: vi.fn(async () => {}),
  }
  render(
    <MemoryRouter>
      <AnalyticsConsentContext.Provider value={value}>
        <PrivacyPage />
      </AnalyticsConsentContext.Provider>
    </MemoryRouter>
  )
  return { openPreferences, user: userEvent.setup() }
}

describe('PrivacyPage', () => {
  it('lists the three cookies with their purpose, life and when they are set', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Política de privacidade' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Cookies usados neste site' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual(['ed_consent', '__Host-ed_vid', '__Host-ed_sid'])
    expect(rows.map((row) => within(row).getAllByRole('cell')[1].textContent)).toEqual([
      '12 meses',
      '395 dias desde a última visita',
      '30 minutos sem atividade',
    ])
    expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual([
      'Guarda a sua escolha (aceitar ou recusar) para não perguntarmos de novo a cada visita.',
      'Reconhece este navegador entre visitas, por meio de um código aleatório que não contém nome, e-mail ou outro dado seu.',
      'Agrupa as páginas lidas numa mesma visita.',
    ])
    expect(rows.map((row) => within(row).getAllByRole('cell')[2].textContent)).toEqual([
      'Quando você escolhe uma opção',
      'Somente se você aceitar',
      'Somente se você aceitar',
    ])
  })

  it('shows when it was last updated', () => {
    renderPage()

    expect(screen.getByText('Última atualização: 25 de outubro de 2026')).toBeInTheDocument()
  })

  it('states the retention periods the backend applies', () => {
    renderPage()

    expect(screen.getByText('Registros de páginas lidas e de visitas: até 425 dias.')).toBeInTheDocument()
    expect(screen.getByText('O identificador do navegador: apagado após 395 dias sem nenhuma visita.')).toBeInTheDocument()
  })

  it('lets the visitor change the choice from the page', async () => {
    const { openPreferences, user } = renderPage()

    await user.click(screen.getByRole('button', { name: 'Preferências de cookies' }))

    expect(openPreferences).toHaveBeenCalledTimes(1)
  })

  it('points rights requests to the contact form', () => {
    renderPage()

    const link = screen.getByRole('link', { name: 'formulário de contato' })
    expect(link).toHaveAttribute('href', '/?section=contato')
    expect(link.parentElement!.textContent).toBe(
      'Pela LGPD, você pode pedir a confirmação de que tratamos seus dados, o acesso a eles, a correção, a anonimização ' +
      'ou a eliminação, informações sobre com quem os compartilhamos e a revogação do consentimento. Para isso, escreva ' +
      'para nós pelo formulário de contato.'
    )
  })
})
