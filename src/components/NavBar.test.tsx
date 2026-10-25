import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import NavBar from './NavBar'

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <NavBar />
    </MemoryRouter>
  )

const menu = () => within(screen.getByRole('list'))

describe('NavBar', () => {
  it('links to every home section, in page order', () => {
    renderAt('/')

    const links = menu().getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Artigos', 'Recursos', 'Quem somos', 'Contato', 'Encontre uma igreja'])
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/?section=artigos',
      '/?section=recursos',
      '/?section=quem-somos',
      '/?section=contato',
      '/?section=encontre-uma-igreja',
    ])
  })

  it.each([
    ['/?section=recursos', 'Recursos'],
    ['/?section=encontre-uma-igreja', 'Encontre uma igreja'],
    ['/?section=contato', 'Contato'],
    ['/', 'Artigos'],
  ])('on %s highlights only "%s" as the current section', (url, current) => {
    renderAt(url)

    for (const link of menu().getAllByRole('link')) {
      const isCurrent = link.textContent === current
      expect(link).toHaveAttribute('aria-current', isCurrent ? 'page' : 'false')
      if (isCurrent) {
        expect(link).toHaveClass('nav-link', 'active-navlink')
      } else {
        expect(link).toHaveClass('nav-link')
        expect(link).not.toHaveClass('active-navlink')
      }
    }
  })

  it('highlights nothing outside the home page', () => {
    renderAt('/artigo/deus-existe?section=recursos')

    for (const link of menu().getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current', 'page')
      expect(link).not.toHaveClass('active-navlink')
    }
  })

  it('folds the expanded mobile menu back when a section is chosen', async () => {
    renderAt('/')
    const toggler = screen.getByRole('button', { name: 'Toggle navigation' })
    const fold = vi.fn()
    toggler.addEventListener('click', fold)
    document.getElementById('navbarNav')!.classList.add('show')

    await userEvent.click(menu().getByRole('link', { name: 'Encontre uma igreja' }))

    expect(fold).toHaveBeenCalledTimes(1)
  })

  it('leaves the menu alone when it is not expanded (desktop)', async () => {
    renderAt('/')
    const fold = vi.fn()
    screen.getByRole('button', { name: 'Toggle navigation' }).addEventListener('click', fold)

    await userEvent.click(menu().getByRole('link', { name: 'Recursos' }))

    expect(fold).not.toHaveBeenCalled()
  })
})
