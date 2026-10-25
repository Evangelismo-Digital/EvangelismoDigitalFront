import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import ArticlePage from './ArticlePage'

vi.mock('../config/api', () => ({ API_URL: 'http://api.test', WEB3FORMS_ACCESS_KEY: 'test-key' }))

// An article module whose frontmatter failed to compile: the page must not render half an article.
vi.mock('../articleContent/articlesData/caminhos.mdx', () => ({
  default: () => 'corpo sem frontmatter',
  frontmatter: undefined,
}))

const visit = (path: string) => {
  const router = createMemoryRouter([{ path: '/artigo/:artigoId', element: <ArticlePage /> }], { initialEntries: [path] })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return router
}

const notFound = () => screen.findByRole('heading', { level: 1, name: 'Página não encontrada' })

describe('ArticlePage', () => {
  it('renders an existing article with its title', async () => {
    visit('/artigo/oMal')

    expect(await screen.findByRole('heading', { level: 1, name: 'Se Deus é bom, por que o mal existe?' })).toBeInTheDocument()
    expect(screen.queryByText('Página não encontrada')).not.toBeInTheDocument()
  })

  it('says the article does not exist for an unknown slug', async () => {
    visit('/artigo/nao-existe')

    expect(await notFound()).toBeInTheDocument()
    expect(screen.getByText('O artigo solicitado não existe.')).toBeInTheDocument()
  })

  it('does not keep showing the previous article when the next one does not exist', async () => {
    const router = visit('/artigo/oMal')
    await screen.findByRole('heading', { level: 1, name: 'Se Deus é bom, por que o mal existe?' })

    await act(() => router.navigate('/artigo/nao-existe'))

    expect(await notFound()).toBeInTheDocument()
    expect(screen.queryByText('Se Deus é bom, por que o mal existe?')).not.toBeInTheDocument()
  })

  it('recovers when a missing article is followed by an existing one', async () => {
    const router = visit('/artigo/nao-existe')
    await notFound()

    await act(() => router.navigate('/artigo/oMal'))

    expect(await screen.findByRole('heading', { level: 1, name: 'Se Deus é bom, por que o mal existe?' })).toBeInTheDocument()
    expect(screen.queryByText('Página não encontrada')).not.toBeInTheDocument()
  })

  it('treats an article without frontmatter as not found rather than rendering half of it', async () => {
    visit('/artigo/caminhos')

    expect(await notFound()).toBeInTheDocument()
    expect(screen.queryByText('corpo sem frontmatter')).not.toBeInTheDocument()
  })
})
