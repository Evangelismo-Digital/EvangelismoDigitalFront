import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ChurchListView, { MISSING_ADDRESS_TEXT } from './ChurchListView'
import { toChurchItem } from '../util/googleMapsUrl'
import type { TravelMode } from '../util/travelMode'
import { backendChurch, fiveBackendChurches } from '../test/churchFixtures'

const churches = fiveBackendChurches().map(toChurchItem)

const origin = { latitude: -22.8968, longitude: -43.1236 }

const renderList = (items = churches, userCep = '24020085', mode: TravelMode = 'pedestrian') =>
  render(<ChurchListView userCep={userCep} mode={mode} churches={items} origin={origin} />)

const stops = () => within(screen.getByRole('list')).getAllByRole('listitem')

describe('ChurchListView', () => {
  it('labels the section with its heading and starts the route at the formatted CEP', () => {
    renderList()

    const section = screen.getByRole('region', { name: 'Igrejas mais próximas' })
    expect(within(section).getByRole('heading', { level: 2, name: 'Igrejas mais próximas' })).toBeInTheDocument()
    expect(within(section).getByText('CEP 24020-085')).toBeInTheDocument()
  })

  it('renders an ordered list with one stop per church, in order', () => {
    renderList()

    expect(screen.getByRole('list').tagName).toBe('OL')
    expect(stops()).toHaveLength(5)
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(churches.map((c) => c.name))
  })

  it('never shows more than five churches', () => {
    const six = [...churches, toChurchItem(backendChurch({ publicId: 'church-6', name: 'Sexta Igreja', distanceKm: 9 }))]

    renderList(six)

    expect(stops()).toHaveLength(5)
    expect(screen.queryByText('Sexta Igreja')).not.toBeInTheDocument()
  })

  it('marks only the nearest stop', () => {
    renderList()

    expect(within(stops()[0]).getByText('Mais próxima')).toBeInTheDocument()
    expect(screen.getAllByText('Mais próxima')).toHaveLength(1)
    expect(stops()[0]).toHaveClass('stop', 'stopNearest')
    stops().slice(1).forEach((stop) => {
      expect(stop).toHaveClass('stop')
      expect(stop).not.toHaveClass('stopNearest')
    })
  })

  it('shows walking distances in pt-BR', () => {
    renderList()

    expect(within(stops()[0]).getByText('450 m a pé')).toBeInTheDocument()
    expect(within(stops()[1]).getByText('1,4 km a pé')).toBeInTheDocument()
  })

  it('shows driving distances when travelling by car', () => {
    renderList(churches, '24020085', 'transport')

    expect(within(stops()[0]).getByText('450 m de carro')).toBeInTheDocument()
    expect(screen.queryByText(/a pé/)).not.toBeInTheDocument()
  })

  it('shows the full address, or the approved fallback when it is missing', () => {
    renderList()

    expect(within(stops()[0]).getByText('R. da Conceição, 100 - Centro, Niterói - RJ')).toBeInTheDocument()
    expect(within(stops()[2]).getByText(MISSING_ADDRESS_TEXT)).toBeInTheDocument()
    expect(MISSING_ADDRESS_TEXT).toBe('Endereço não informado — toque para ver no mapa.')
  })

  it('links each stop to the exact point on Google Maps in a new tab', () => {
    renderList()

    const link = within(stops()[0]).getByRole('link', { name: /Ver no Google Maps/ })
    expect(link).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=-22.894623%2C-43.123987')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveTextContent('Ver no Google Maps')
  })

  it('announces rank, name, distance, address and action on the map link', () => {
    renderList()

    expect(within(stops()[0]).getByRole('link', { name: /Ver no Google Maps/ })).toHaveAccessibleName(
      '1ª igreja: Igreja Batista Central, a 450 m a pé. R. da Conceição, 100 - Centro, Niterói - RJ Ver no Google Maps (abre em nova aba).'
    )
    expect(within(stops()[2]).getByRole('link', { name: /Ver no Google Maps/ })).toHaveAccessibleName(
      `3ª igreja: Comunidade Evangélica Ingá, a 2,1 km a pé. ${MISSING_ADDRESS_TEXT} Ver no Google Maps (abre em nova aba).`
    )
  })

  it('offers walking directions when travelling on foot', () => {
    renderList()

    const link = within(stops()[1]).getByRole('link', { name: 'Como chegar a Igreja Presbiteriana Icaraí a pé pelo Google Maps (abre em nova aba).' })
    expect(link).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&origin=-22.896800%2C-43.123600&destination=-22.903000%2C-43.108000&travelmode=walking')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveTextContent('Como chegar')
  })

  it('offers driving directions when travelling by car', () => {
    renderList(churches, '24020085', 'transport')

    const link = within(stops()[1]).getByRole('link', { name: 'Como chegar a Igreja Presbiteriana Icaraí de carro pelo Google Maps (abre em nova aba).' })
    expect(link).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&origin=-22.896800%2C-43.123600&destination=-22.903000%2C-43.108000&travelmode=driving')
  })

  it('starts every "Como chegar" at the searched CEP', () => {
    renderList()

    for (const stop of stops()) {
      expect(within(stop).getByRole('link', { name: /^Como chegar/ }).getAttribute('href')).toMatch(
        /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&origin=-22\.896800%2C-43\.123600&destination=/
      )
    }
  })

  it('leaves the start to the device when the backend sent no origin', () => {
    render(<ChurchListView userCep="24020085" mode="pedestrian" churches={churches} />)

    const link = within(stops()[0]).getByRole('link', { name: /^Como chegar/ })
    expect(link).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=-22.894623%2C-43.123987&travelmode=walking')
  })

  it('does not nest links and shows no raw coordinates', () => {
    const { container } = renderList()

    expect(container.querySelectorAll('a a')).toHaveLength(0)
    expect(screen.getAllByRole('link')).toHaveLength(10)
    expect(container.textContent).not.toMatch(/-22\.\d{4}/)
  })

  it('decorates every stop with its three inline icons, hidden from screen readers', () => {
    renderList()

    for (const stop of stops()) {
      const icons = stop.querySelectorAll('svg')
      expect(icons).toHaveLength(3)
      icons.forEach((icon) => {
        expect(icon).toHaveAttribute('aria-hidden', 'true')
        expect(icon).toHaveAttribute('focusable', 'false')
      })
      expect(stop.querySelector('p svg')).not.toBeNull()
      expect(within(stop).getByRole('link', { name: /Ver no Google Maps/ }).querySelector('svg')).not.toBeNull()
      expect(within(stop).getByRole('link', { name: /^Como chegar/ }).querySelector('svg')).not.toBeNull()
    }
  })

  it('draws a route marker for the origin and every stop, hidden from screen readers', () => {
    const { container } = renderList()

    expect(container.querySelectorAll('.originMarker')).toHaveLength(1)
    expect(container.querySelectorAll('.stopMarker')).toHaveLength(5)
    container.querySelectorAll('.originMarker, .stopMarker').forEach((marker) => {
      expect(marker).toHaveAttribute('aria-hidden', 'true')
    })
  })

  it('renders an empty list without crashing', () => {
    renderList([])

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('keeps an unformattable CEP as typed', () => {
    renderList(churches, '2402')

    expect(screen.getByText('CEP 2402')).toBeInTheDocument()
  })
})
