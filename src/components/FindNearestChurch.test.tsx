import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import FindNearestChurch, { CORREIOS_CEP_SEARCH_URL, NO_CHURCHES_WALKING_MESSAGE } from './FindNearestChurch'
import { NEAREST_CHURCHES_MESSAGES } from '../util/nearestChurchesApi'
import { jsonResponse, nearestResponse } from '../test/churchFixtures'
import { track } from '../analytics/analytics'

vi.mock('../config/api', () => ({ API_URL: 'http://api.test', WEB3FORMS_ACCESS_KEY: 'test-key' }))
// Analytics only runs with consent; here it is a spy so the reported search can be checked.
vi.mock('../analytics/analytics', () => ({ track: vi.fn() }))

type Route = (url: string) => Response | Promise<Response>

let backend: Route
let web3forms: Route
let fetchMock: MockInstance<typeof fetch>

const backendCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith('http://api.test/'))
const web3formsCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith('https://api.web3forms.com/'))
const leadBody = (call = 0) => JSON.parse(String(web3formsCalls()[call][1]?.body))

const renderSection = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
  const user = userEvent.setup()
  const { container } = render(
    <QueryClientProvider client={client}>
      <FindNearestChurch />
    </QueryClientProvider>
  )
  return { user, client, container }
}

const cepInput = () => screen.getByLabelText('CEP')
const emailInput = () => screen.getByLabelText('Email')
const submit = () => screen.getByRole('button', { name: /Buscar igrejas|Buscando/ })

const search = async (user: ReturnType<typeof userEvent.setup>, cep: string, email = 'maria@email.com') => {
  await user.clear(cepInput())
  if (cep) {
    await user.type(cepInput(), cep)
  }
  await user.clear(emailInput())
  if (email) {
    await user.type(emailInput(), email)
  }
  await user.click(submit())
}

beforeEach(() => {
  backend = () => jsonResponse(nearestResponse())
  web3forms = () => jsonResponse({ success: true, message: 'ok' })
  fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    return url.startsWith('https://api.web3forms.com/') ? web3forms(url) : backend(url)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FindNearestChurch', () => {
  describe('before searching', () => {
    it('shows the invitation and the form without calling the backend or showing results', () => {
      const { container } = renderSection()

      expect(screen.getByRole('heading', { level: 1, name: 'Encontre uma igreja perto de você' })).toBeInTheDocument()
      expect(screen.getByText('digite seu CEP para se conectar com nossa equipe de voluntários e com igrejas perto de você.')).toHaveClass('lead')
      expect(cepInput()).toHaveAttribute('inputmode', 'numeric')
      // Fixed ids (not useId), so the prerendered HTML and the hydrated page agree (React #418).
      expect(cepInput()).toHaveAttribute('id', 'find-church-cep')
      expect(emailInput()).toHaveAttribute('id', 'find-church-email')
      expect(cepInput()).toHaveAttribute('autocomplete', 'postal-code')
      expect(emailInput()).toHaveAttribute('autocomplete', 'email')
      expect(submit()).toHaveTextContent('Buscar igrejas')
      expect(container.querySelector('.resultsSection')).toBeEmptyDOMElement()
      // Styling hooks: the large CEP field and the email field.
      expect(cepInput()).toHaveClass('input', 'cepInput')
      expect(emailInput()).toHaveClass('input')
      expect(emailInput()).not.toHaveClass('cepInput')
      expect(emailInput().closest('.field')).toHaveClass('field', 'emailField')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('puts the search button after both fields, inside the card with the illustration', () => {
      const { container } = renderSection()

      const card = container.querySelector('.card')
      expect(card).toContainElement(submit())
      const fields = [cepInput(), emailInput(), submit()]
      fields.slice(1).forEach((field, index) => {
        expect(fields[index].compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      })
      const illustration = card?.querySelector('.art svg')
      expect(illustration).toHaveAttribute('aria-hidden', 'true')
      expect(illustration).toHaveClass('illustration')
    })

    it('no longer links to the old placeholder map', () => {
      renderSection()

      expect(screen.queryByRole('link', { name: /Ver todas as igrejas no mapa/ })).not.toBeInTheDocument()
      expect(screen.getAllByRole('link')).toHaveLength(1)
    })

    it('explains what a CEP is, with a link to look it up at the Correios', () => {
      renderSection()

      expect(cepInput()).toHaveAccessibleDescription(
        'CEP é o código postal de 8 números do seu endereço, como 24230-100. Não sabe o seu? Consulte nos Correios.'
      )
      const link = screen.getByRole('link', { name: 'Consulte nos Correios (abre em nova aba)' })
      expect(link).toHaveAttribute('href', CORREIOS_CEP_SEARCH_URL)
      expect(CORREIOS_CEP_SEARCH_URL).toBe('https://buscacepinter.correios.com.br/app/endereco/index.php')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      expect(link).toHaveTextContent('Consulte nos Correios')
    })

    it('marks both fields as required and explains what the email is for, linked to the field', () => {
      renderSection()

      expect(cepInput()).toHaveAttribute('aria-required', 'true')
      expect(emailInput()).toHaveAttribute('aria-required', 'true')
      expect(emailInput()).toHaveAccessibleDescription(
        'Nossa equipe poderá entrar em contato para ajudar você a conhecer uma igreja.'
      )
      expect(cepInput()).not.toHaveAttribute('aria-invalid')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('draws an icon on each travel option, field and the search button, hidden from screen readers', () => {
      renderSection()

      const icons = [
        screen.getByText('A pé').querySelector('svg'),
        screen.getByText('Por transporte').querySelector('svg'),
        cepInput().parentElement?.querySelector('svg'),
        emailInput().parentElement?.querySelector('svg'),
        submit().querySelector('svg'),
      ]
      icons.forEach((icon) => {
        expect(icon).toHaveAttribute('aria-hidden', 'true')
        expect(icon).toHaveAttribute('focusable', 'false')
        expect(icon).toHaveClass('icon')
      })
      expect(cepInput().parentElement).toHaveClass('inputWrap')
      expect(emailInput().parentElement).toHaveClass('inputWrap')
    })

    it('no longer renders any embedded map', () => {
      const { container } = (() => {
        const client = new QueryClient()
        return render(
          <QueryClientProvider client={client}>
            <FindNearestChurch />
          </QueryClientProvider>
        )
      })()

      expect(container.querySelector('iframe')).toBeNull()
    })
  })

  describe('form', () => {
    it('asks how the person travels, walking by default', () => {
      renderSection()

      const group = screen.getByRole('group', { name: 'Como você vai até a igreja?' })
      expect(within(group).getByRole('radio', { name: 'A pé' })).toBeChecked()
      expect(within(group).getByRole('radio', { name: 'Por transporte' })).not.toBeChecked()
    })

    it('searches by car when "Por transporte" is chosen', async () => {
      const { user } = renderSection()

      await user.click(screen.getByRole('radio', { name: 'Por transporte' }))
      await search(user, '24020085')

      const region = await screen.findByRole('region', { name: 'Igrejas mais próximas' })
      expect(within(region).getByText('450 m por transporte')).toBeInTheDocument()
      expect(String(backendCalls()[0][0])).toBe('http://api.test/churches/nearest?cep=24020085&mode=transport')
    })

    it('repeats the search for the same CEP when the travel mode changes afterwards', async () => {
      const { user } = renderSection()

      await search(user, '24020085')
      await screen.findByText('450 m a pé')
      await user.click(screen.getByRole('radio', { name: 'Por transporte' }))

      expect(await screen.findByText('450 m por transporte')).toBeInTheDocument()
      await user.click(screen.getByRole('radio', { name: 'A pé' }))
      expect(await screen.findByText('450 m a pé')).toBeInTheDocument()
      expect(backendCalls().map(([url]) => String(url).split('?')[1])).toEqual([
        'cep=24020085&mode=pedestrian',
        'cep=24020085&mode=transport',
      ])
    })

    it('does not search when the travel mode changes before any search', async () => {
      const { user } = renderSection()

      await user.click(screen.getByRole('radio', { name: 'Por transporte' }))

      expect(fetchMock).not.toHaveBeenCalled()
      expect(screen.queryByRole('region', { name: 'Igrejas mais próximas' })).not.toBeInTheDocument()
    })

    it('masks the CEP while typing', async () => {
      const { user } = renderSection()

      await user.type(cepInput(), '24020085')

      expect(cepInput()).toHaveValue('24020-085')
    })

    it('validates a field as soon as it loses focus', async () => {
      const { user } = renderSection()

      await user.type(cepInput(), '240')
      await user.tab()

      expect(await screen.findByText('CEP deve ter 8 dígitos.')).toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('reserves the error line with a non-breaking space while there is no error', () => {
      const { container } = (() => {
        const client = new QueryClient()
        return render(
          <QueryClientProvider client={client}>
            <FindNearestChurch />
          </QueryClientProvider>
        )
      })()

      const errorLines = container.querySelectorAll('.errorMessage')
      expect(errorLines).toHaveLength(3)
      errorLines.forEach((line) => expect(line.textContent).toBe('\u00A0'))
    })

    it('ignores letters and extra digits in the CEP', async () => {
      const { user } = renderSection()

      await user.type(cepInput(), '24a020-08599')

      expect(cepInput()).toHaveValue('24020-085')
    })

    it('requires a CEP and does not search', async () => {
      const { user } = renderSection()

      await search(user, '')

      expect(await screen.findByText('Digite seu CEP.')).toBeInTheDocument()
      expect(cepInput()).toHaveAttribute('aria-invalid', 'true')
      expect(cepInput()).toHaveAccessibleName('CEP')
      expect(cepInput()).toHaveAccessibleDescription(
        'CEP é o código postal de 8 números do seu endereço, como 24230-100. Não sabe o seu? Consulte nos Correios. Digite seu CEP.'
      )
      expect(screen.getByRole('alert')).toHaveTextContent('Digite seu CEP.')
      expect(emailInput()).not.toHaveAttribute('aria-invalid')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('rejects an incomplete CEP', async () => {
      const { user } = renderSection()

      await search(user, '2402008')

      expect(await screen.findByText('CEP deve ter 8 dígitos.')).toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('flags both empty fields at once', async () => {
      const { user } = renderSection()

      await user.click(submit())

      expect((await screen.findAllByRole('alert')).map((alert) => alert.textContent)).toEqual(['Digite seu CEP.', 'Digite seu email.'])
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('requires an email and does not search', async () => {
      const { user } = renderSection()

      await search(user, '24020085', '')

      expect(await screen.findByText('Digite seu email.')).toBeInTheDocument()
      expect(emailInput()).toHaveAttribute('aria-invalid', 'true')
      expect(emailInput()).toHaveAccessibleDescription(
        'Nossa equipe poderá entrar em contato para ajudar você a conhecer uma igreja. Digite seu email.'
      )
      expect(screen.getByRole('alert')).toHaveTextContent('Digite seu email.')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('rejects an invalid email', async () => {
      const { user } = renderSection()

      await search(user, '24020085', 'maria@')

      expect(await screen.findByText('Digite um email válido.')).toBeInTheDocument()
      expect(emailInput()).toHaveAttribute('aria-invalid', 'true')
      expect(emailInput()).toHaveAccessibleDescription(
        'Nossa equipe poderá entrar em contato para ajudar você a conhecer uma igreja. Digite um email válido.'
      )
      expect(screen.getByRole('alert')).toHaveTextContent('Digite um email válido.')
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('successful search', () => {
    it('lists the five nearest churches for the CEP', async () => {
      const { user } = renderSection()

      await search(user, '24020-085')

      const region = await screen.findByRole('region', { name: 'Igrejas mais próximas' })
      expect(within(region).getByText('CEP 24020-085')).toBeInTheDocument()
      expect(within(region).getAllByRole('listitem')).toHaveLength(5)
      expect(within(region).getAllByRole('heading', { level: 3 })[0]).toHaveTextContent('Igreja Batista Central')
      expect(backendCalls()).toHaveLength(1)
      expect(String(backendCalls()[0][0])).toBe('http://api.test/churches/nearest?cep=24020085&mode=pedestrian')
    })

    it('shows the loading state and disables the button while searching', async () => {
      let release!: (response: Response) => void
      backend = () => new Promise<Response>((resolve) => { release = resolve })
      const { user } = renderSection()

      await search(user, '24020085')

      expect(await screen.findByRole('status')).toHaveTextContent('Buscando as igrejas mais próximas...')
      expect(submit()).toBeDisabled()
      expect(submit()).toHaveTextContent('Buscando...')
      expect(submit().querySelector('svg')).toBeNull()
      expect(submit().querySelector('.buttonSpinner')).toHaveAttribute('aria-hidden', 'true')

      release(jsonResponse(nearestResponse()))

      expect(await screen.findByRole('region', { name: 'Igrejas mais próximas' })).toBeInTheDocument()
      expect(submit()).toBeEnabled()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('reports every search, including each repeat by car or on foot, with the email given', async () => {
      const { user } = renderSection()

      await search(user, '24020085', 'maria@email.com')
      await screen.findByText('450 m a pé')
      await user.click(screen.getByRole('radio', { name: 'Por transporte' }))
      await screen.findByText('450 m por transporte')

      await waitFor(() => expect(web3formsCalls()).toHaveLength(2))
      expect(leadBody(0)).toMatchObject({ email: 'maria@email.com', como_vai: 'a pé' })
      expect(leadBody(1)).toMatchObject({ email: 'maria@email.com', como_vai: 'por transporte' })
    })

    it('reports each search with the email submitted with it', async () => {
      const { user } = renderSection()

      await search(user, '24020085', 'maria@email.com')
      await screen.findByText('CEP 24020-085')
      await search(user, '24230100', 'joao@email.com')
      await screen.findByText('CEP 24230-100')

      await waitFor(() => expect(web3formsCalls()).toHaveLength(2))
      expect(leadBody(0)).toMatchObject({ email: 'maria@email.com', cep: '24020-085' })
      expect(leadBody(1)).toMatchObject({ email: 'joao@email.com', cep: '24230-100' })
    })

    it('sends one lead with the nearest church when an email is given, without a second backend call', async () => {
      const { user } = renderSection()

      await search(user, '24020085', '  Maria@Email.com ')
      await screen.findByRole('region', { name: 'Igrejas mais próximas' })

      await waitFor(() => expect(web3formsCalls()).toHaveLength(1))
      expect(leadBody()).toMatchObject({
        access_key: 'test-key',
        subject: 'Busca de igreja - CEP 24020-085',
        email: 'maria@email.com',
        cep: '24020-085',
        como_vai: 'a pé',
        igreja_mais_proxima: 'Igreja Batista Central',
      })
      expect(backendCalls()).toHaveLength(1)
    })

    it('reuses the cached result when the same CEP is searched again', async () => {
      const { user } = renderSection()

      await search(user, '24020085')
      await screen.findByRole('region', { name: 'Igrejas mais próximas' })
      await search(user, '24020-085')

      expect(await screen.findByRole('region', { name: 'Igrejas mais próximas' })).toBeInTheDocument()
      expect(backendCalls()).toHaveLength(1)
      // Still a search: the repeat is reported too, from the saved result.
      await waitFor(() => expect(web3formsCalls()).toHaveLength(2))
      expect(leadBody(1)).toMatchObject({ cep: '24020-085', igreja_mais_proxima: 'Igreja Batista Central' })
    })

    it('searches again for a different CEP', async () => {
      const { user } = renderSection()

      await search(user, '24020085')
      await screen.findByText('CEP 24020-085')
      await search(user, '01001000')

      expect(await screen.findByText('CEP 01001-000')).toBeInTheDocument()
      expect(backendCalls().map(([url]) => String(url))).toEqual([
        'http://api.test/churches/nearest?cep=24020085&mode=pedestrian',
        'http://api.test/churches/nearest?cep=01001000&mode=pedestrian',
      ])
    })

    it('keeps the results when the lead fails to send', async () => {
      web3forms = () => jsonResponse({ success: false, message: 'Chave inválida' }, 400)
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { user } = renderSection()

      await search(user, '24020085', 'maria@email.com')

      expect(await screen.findByRole('region', { name: 'Igrejas mais próximas' })).toBeInTheDocument()
      await waitFor(() =>
        expect(consoleError).toHaveBeenCalledWith('Falha ao enviar o contato da busca de igreja:', expect.any(Error))
      )
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('results placement', () => {
    const scrollCalls = () => vi.mocked(Element.prototype.scrollIntoView).mock

    beforeEach(() => {
      vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('shows the results inside the card, in the illustration\'s place', async () => {
      const { user, container } = renderSection()
      const card = container.querySelector('.card') as HTMLElement
      expect(card.querySelector('.art')).not.toBeNull()
      expect(card).not.toHaveClass('cardWithResults')

      await search(user, '24020085')

      const region = await screen.findByRole('region', { name: 'Igrejas mais próximas' })
      expect(card).toContainElement(region)
      expect(card).toHaveClass('card', 'cardWithResults')
      expect(card.querySelector('.art')).toBeNull()
      expect(region.closest('.resultsSection')).toHaveAttribute('aria-live', 'polite')
    })

    it('does not scroll before the first search', async () => {
      const { user } = renderSection()

      await user.type(cepInput(), '24020085')
      await user.click(screen.getByRole('radio', { name: 'Por transporte' }))

      expect(scrollCalls().calls).toHaveLength(0)
    })

    it('scrolls the results into view while loading, and again once they are shown', async () => {
      let release!: (response: Response) => void
      backend = () => new Promise<Response>((resolve) => { release = resolve })
      const { user, container } = renderSection()
      const results = container.querySelector('.resultsSection')

      await search(user, '24020085')
      await screen.findByRole('status')

      expect(scrollCalls().calls).toEqual([[{ behavior: 'smooth', block: 'start' }]])
      expect(scrollCalls().contexts[0]).toBe(results)

      release(jsonResponse(nearestResponse()))
      await screen.findByRole('region', { name: 'Igrejas mais próximas' })

      await waitFor(() => expect(scrollCalls().calls).toHaveLength(2))
      expect(scrollCalls().contexts[1]).toBe(results)
      // Nothing more until the next search.
      await user.hover(submit())
      expect(scrollCalls().calls).toHaveLength(2)
    })

    it('scrolls to an error, and to each repeated search', async () => {
      backend = (url) => url.includes('mode=transport')
        ? jsonResponse(nearestResponse())
        : jsonResponse({ message: 'x', code: 'NO_NEARBY_CHURCHES_FOUND' }, 404)
      const { user } = renderSection()

      await search(user, '24020085')
      await screen.findByRole('alert')
      const afterError = scrollCalls().calls.length
      expect(afterError).toBeGreaterThanOrEqual(1)

      await user.click(screen.getByRole('button', { name: 'Ver igrejas por transporte' }))
      await screen.findByText('450 m por transporte')

      await waitFor(() => expect(scrollCalls().calls.length).toBeGreaterThan(afterError))
    })

    it('does not scroll again when "Tentar novamente" refreshes the results already in view', async () => {
      backend = () => jsonResponse(null, 503)
      const { user } = renderSection()

      await search(user, '24020085')
      await screen.findByRole('alert')
      const afterError = scrollCalls().calls.length

      let release!: (response: Response) => void
      backend = () => new Promise<Response>((resolve) => { release = resolve })
      await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
      await screen.findByRole('status')
      release(jsonResponse(nearestResponse()))
      await screen.findByRole('region', { name: 'Igrejas mais próximas' })

      expect(scrollCalls().calls).toHaveLength(afterError)
    })

    it('waits for the web fonts before scrolling, so a search right after the page opens lands where it should', async () => {
      let fontsReady!: () => void
      Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>((r) => { fontsReady = r }) } })
      try {
        const { user, container } = renderSection()

        await search(user, '24020085')
        await screen.findByRole('region', { name: 'Igrejas mais próximas' })
        expect(scrollCalls().calls).toHaveLength(0)

        await act(async () => fontsReady())

        await waitFor(() => expect(scrollCalls().calls.length).toBeGreaterThan(0))
        expect(scrollCalls().contexts[0]).toBe(container.querySelector('.resultsSection'))
      } finally {
        delete (document as { fonts?: unknown }).fonts
      }
    })

    it('jumps without animation when the person prefers reduced motion', async () => {
      vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }))
      const { user } = renderSection()

      await search(user, '24020085')
      await screen.findByRole('region', { name: 'Igrejas mais próximas' })

      expect(scrollCalls().calls[0]).toEqual([{ behavior: 'auto', block: 'start' }])
    })
  })

  describe('analytics (only reaches the backend with consent)', () => {
    const searchEvents = () => vi.mocked(track).mock.calls.map(([event]) => event).filter((e) => e.eventType === 'search')

    beforeEach(() => {
      vi.mocked(track).mockClear()
    })

    it('reports a search that found churches: mode and count, never the CEP or email', async () => {
      const { user } = renderSection()

      await user.click(screen.getByRole('radio', { name: 'Por transporte' }))
      await search(user, '24020085', 'maria@email.com')

      await waitFor(() => expect(searchEvents()).toHaveLength(1))
      expect(searchEvents()[0]).toEqual({
        eventType: 'search',
        path: '/',
        payload: { mode: 'transport', outcome: 'found', resultCount: 5 },
      })
      expect(JSON.stringify(searchEvents())).not.toMatch(/24020|maria/)
    })

    it('reports "none" when no church is nearby, and "error" when the search failed', async () => {
      backend = (url) => url.includes('mode=transport')
        ? jsonResponse(null, 503)
        : jsonResponse({ message: 'x', code: 'NO_NEARBY_CHURCHES_FOUND' }, 404)
      const { user } = renderSection()

      await search(user, '24020085')
      await screen.findByRole('alert')
      await user.click(screen.getByRole('radio', { name: 'Por transporte' }))

      await waitFor(() => expect(searchEvents()).toHaveLength(2))
      expect(searchEvents().map((e) => e.payload)).toEqual([
        { mode: 'pedestrian', outcome: 'none', resultCount: 0 },
        { mode: 'transport', outcome: 'error', resultCount: 0 },
      ])
    })
  })

  describe('failed search', () => {
    it('says nothing is within walking distance and offers to search by car', async () => {
      backend = (url) => url.includes('mode=transport')
        ? jsonResponse(nearestResponse())
        : jsonResponse({ message: 'Nenhuma igreja encontrada nas proximidades.', code: 'NO_NEARBY_CHURCHES_FOUND' }, 404)
      const { user } = renderSection()

      await search(user, '24020085')

      expect(await screen.findByRole('alert')).toHaveTextContent(NO_CHURCHES_WALKING_MESSAGE)
      expect(NO_CHURCHES_WALKING_MESSAGE).toBe('Nenhuma igreja a até 10 km a pé desse CEP.')
      expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Ver igrejas por transporte' }))

      const region = await screen.findByRole('region', { name: 'Igrejas mais próximas' })
      expect(within(region).getByText('450 m por transporte')).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: 'Por transporte' })).toBeChecked()
      expect(backendCalls().map(([url]) => String(url).split('?')[1])).toEqual([
        'cep=24020085&mode=pedestrian',
        'cep=24020085&mode=transport',
      ])
      await waitFor(() => expect(web3formsCalls()).toHaveLength(2))
      expect(leadBody(0)).toMatchObject({ como_vai: 'a pé', igreja_mais_proxima: 'nenhuma encontrada' })
      expect(leadBody(1)).toMatchObject({ como_vai: 'por transporte', igreja_mais_proxima: 'Igreja Batista Central' })
    })

    it('explains that no church is registered near the CEP by car, with no fallback or retry', async () => {
      backend = () => jsonResponse({ message: 'Nenhuma igreja encontrada nas proximidades.', code: 'NO_NEARBY_CHURCHES_FOUND' }, 404)
      const { user } = renderSection()

      await user.click(screen.getByRole('radio', { name: 'Por transporte' }))
      await search(user, '24020085')

      expect(await screen.findByRole('alert')).toHaveTextContent(NEAREST_CHURCHES_MESSAGES['no-churches'])
      expect(screen.queryByRole('button', { name: 'Ver igrejas por transporte' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Igrejas mais próximas' })).not.toBeInTheDocument()
      expect(backendCalls()).toHaveLength(1)
    })

    it('asks the user to check an unknown CEP, with no retry', async () => {
      backend = () => jsonResponse({ message: 'O CEP fornecido não existe.', code: 'INVALID_CEP' }, 404)
      const { user } = renderSection()

      await search(user, '99999999')

      expect(await screen.findByRole('alert')).toHaveTextContent(NEAREST_CHURCHES_MESSAGES['cep-not-found'])
      expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
    })

    it('records the travel mode in the lead', async () => {
      const { user } = renderSection()

      await user.click(screen.getByRole('radio', { name: 'Por transporte' }))
      await search(user, '24020085', 'maria@email.com')

      await waitFor(() => expect(web3formsCalls()).toHaveLength(1))
      expect(leadBody()).toMatchObject({ como_vai: 'por transporte', igreja_mais_proxima: 'Igreja Batista Central' })
    })

    it('still sends the lead, saying none was found', async () => {
      backend = () => jsonResponse({ message: 'x', code: 'NO_NEARBY_CHURCHES_FOUND' }, 404)
      const { user } = renderSection()

      await search(user, '24020085', 'maria@email.com')

      await screen.findByRole('alert')
      await waitFor(() => expect(web3formsCalls()).toHaveLength(1))
      expect(leadBody()).toMatchObject({ email: 'maria@email.com', igreja_mais_proxima: 'nenhuma encontrada' })
    })

    it('asks the backend again when a failed search is submitted again, and reports only the new answer', async () => {
      backend = () => jsonResponse(null, 503)
      const { user } = renderSection()

      await search(user, '24020085')
      expect(await screen.findByRole('alert')).toHaveTextContent(NEAREST_CHURCHES_MESSAGES.unavailable)
      await waitFor(() => expect(web3formsCalls()).toHaveLength(1))

      let release!: (response: Response) => void
      backend = () => new Promise<Response>((resolve) => { release = resolve })
      await search(user, '24020-085')

      // While it is asked again, the old failure is not reported a second time.
      expect(await screen.findByRole('status')).toHaveTextContent('Buscando as igrejas mais próximas...')
      expect(web3formsCalls()).toHaveLength(1)
      release(jsonResponse(nearestResponse()))

      expect(await screen.findByRole('region', { name: 'Igrejas mais próximas' })).toBeInTheDocument()
      expect(backendCalls()).toHaveLength(3)
      await waitFor(() => expect(web3formsCalls()).toHaveLength(2))
      expect(leadBody(0)).toMatchObject({ igreja_mais_proxima: 'nenhuma encontrada' })
      expect(leadBody(1)).toMatchObject({ igreja_mais_proxima: 'Igreja Batista Central' })
    })

    it('asks again only for the failed search: other saved searches stay cached', async () => {
      backend = (url) => (url.includes('cep=24230100') ? jsonResponse(null, 503) : jsonResponse(nearestResponse()))
      const { user } = renderSection()

      await search(user, '24020085')
      await screen.findByText('CEP 24020-085')
      await search(user, '24230100')
      await screen.findByRole('alert')
      await search(user, '24230100')
      await screen.findByRole('alert')
      const callsBefore = backendCalls().length

      await search(user, '24020085')
      await screen.findByText('CEP 24020-085')

      expect(backendCalls()).toHaveLength(callsBefore)
    })

    it('offers a retry when rate limited, without retrying automatically', async () => {
      backend = () => jsonResponse({ message: 'x', code: 'RATE_LIMITED' }, 429)
      const { user } = renderSection()

      await search(user, '24020085')

      expect(await screen.findByRole('alert')).toHaveTextContent(NEAREST_CHURCHES_MESSAGES['rate-limited'])
      expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
      expect(backendCalls()).toHaveLength(1)
    })

    it('waits for a fresh result before reporting a search that failed earlier', async () => {
      let walkingCalls = 0
      backend = (url) => url.includes('mode=pedestrian') && ++walkingCalls === 1
        ? jsonResponse({ message: 'x', code: 'NO_NEARBY_CHURCHES_FOUND' }, 404)
        : jsonResponse(nearestResponse())
      const { user } = renderSection()

      await search(user, '24020085')
      await screen.findByRole('alert')
      await user.click(screen.getByRole('radio', { name: 'Por transporte' }))
      await screen.findByText('450 m por transporte')
      // Back on foot: the failed walking search is fetched again, and this time it finds churches.
      await user.click(screen.getByRole('radio', { name: 'A pé' }))
      await screen.findByText('450 m a pé')

      await waitFor(() => expect(web3formsCalls()).toHaveLength(3))
      expect(web3formsCalls().map((_, index) => [leadBody(index).como_vai, leadBody(index).igreja_mais_proxima])).toEqual([
        ['a pé', 'nenhuma encontrada'],
        ['por transporte', 'Igreja Batista Central'],
        ['a pé', 'Igreja Batista Central'],
      ])
    })

    it('reports a search only once its result is known, after the automatic retry', async () => {
      let attempts = 0
      backend = () => (++attempts === 1 ? jsonResponse(null, 503) : jsonResponse(nearestResponse()))
      const { user } = renderSection()

      await search(user, '24020085')

      expect(await screen.findByRole('region', { name: 'Igrejas mais próximas' })).toBeInTheDocument()
      await waitFor(() => expect(web3formsCalls()).toHaveLength(1))
      expect(leadBody()).toMatchObject({ igreja_mais_proxima: 'Igreja Batista Central' })
      expect(backendCalls()).toHaveLength(2)
    })

    it('retries a transient failure once, then lets the user retry and recover', async () => {
      let attempts = 0
      backend = () => {
        attempts += 1
        return attempts <= 2 ? jsonResponse(null, 503) : jsonResponse(nearestResponse())
      }
      const { user } = renderSection()

      await search(user, '24020085')

      expect(await screen.findByRole('alert')).toHaveTextContent(NEAREST_CHURCHES_MESSAGES.unavailable)
      expect(backendCalls()).toHaveLength(2)

      await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

      expect(await screen.findByRole('region', { name: 'Igrejas mais próximas' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(backendCalls()).toHaveLength(3)
    })

    it('treats an unexpected failure as unavailable and retryable', async () => {
      backend = () => ({ ok: true, status: 200 }) as Response
      const { user } = renderSection()

      await search(user, '24020085')

      expect(await screen.findByRole('alert')).toHaveTextContent(NEAREST_CHURCHES_MESSAGES.unavailable)
      expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    })

    it('tells an offline user to check the connection, then loads once back online', async () => {
      const { user } = renderSection()
      onlineManager.setOnline(false)

      try {
        await search(user, '24020085')

        expect(await screen.findByRole('alert')).toHaveTextContent(NEAREST_CHURCHES_MESSAGES.unavailable)
        expect(backendCalls()).toHaveLength(0)

        onlineManager.setOnline(true)

        expect(await screen.findByRole('region', { name: 'Igrejas mais próximas' })).toBeInTheDocument()
        expect(backendCalls()).toHaveLength(1)
      } finally {
        onlineManager.setOnline(true)
      }
    })

    it('treats a network failure as unavailable', async () => {
      backend = () => {
        throw new TypeError('Failed to fetch')
      }
      const { user } = renderSection()

      await search(user, '24020085')

      expect(await screen.findByRole('alert')).toHaveTextContent(NEAREST_CHURCHES_MESSAGES.unavailable)
    })
  })
})

describe('FindNearestChurch phone (optional)', () => {
  const phoneInput = () => screen.getByLabelText('Telefone (opcional)')

  it('masks the phone and sends it with the lead, also when the search is repeated by car', async () => {
    const { user } = renderSection()

    await user.type(phoneInput(), '21987654321')
    expect(phoneInput()).toHaveValue('(21) 98765-4321')
    await search(user, '24020085')
    await screen.findByRole('region', { name: 'Igrejas mais próximas' })
    await waitFor(() => expect(web3formsCalls()).toHaveLength(1))
    await user.click(screen.getByRole('radio', { name: 'Por transporte' }))

    await waitFor(() => expect(web3formsCalls()).toHaveLength(2))
    expect(leadBody(0)).toMatchObject({ email: 'maria@email.com', telefone: '(21) 98765-4321', como_vai: 'a pé' })
    expect(leadBody(1)).toMatchObject({ email: 'maria@email.com', telefone: '(21) 98765-4321', como_vai: 'por transporte' })
  })

  it('lays the phone out as a field with its icon', () => {
    renderSection()

    expect(phoneInput()).toHaveValue('')
    const field = phoneInput().closest('.field')
    expect(field).toHaveClass('phoneField')
    expect(phoneInput().parentElement?.querySelector('svg')).not.toBeNull()
  })

  it('searches without a phone', async () => {
    const { user } = renderSection()

    await search(user, '24020085')

    await waitFor(() => expect(web3formsCalls()).toHaveLength(1))
    expect(leadBody()).toMatchObject({ telefone: 'não informado' })
    expect(phoneInput()).not.toHaveAttribute('aria-invalid')
    expect(phoneInput()).not.toHaveAttribute('aria-describedby')
  })

  it('blocks the search on an invalid phone, pointing the field at its message', async () => {
    const { user } = renderSection()

    await user.type(phoneInput(), '2198765')
    await search(user, '24020085')

    expect(await screen.findByRole('alert')).toHaveTextContent('Digite um telefone válido com DDD.')
    expect(phoneInput()).toHaveAttribute('aria-invalid', 'true')
    expect(phoneInput()).toHaveAttribute('aria-describedby', 'find-church-phone-error')
    expect(backendCalls()).toHaveLength(0)
  })
})
