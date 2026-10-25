import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Artigos from './Artigos'
import { articlesIndex } from '../articleContent/ArticlesIndex'

const ArticleStub = () => {
  const { artigoId } = useParams()
  return <p>artigo: {artigoId}</p>
}

const renderArtigos = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Artigos />} />
        <Route path="/artigo/:artigoId" element={<ArticleStub />} />
      </Routes>
    </MemoryRouter>
  )

describe('Artigos', () => {
  it('lists the first page of article cards', () => {
    renderArtigos()

    expect(screen.getByRole('heading', { level: 1, name: 'Artigos' })).toBeInTheDocument()
    for (const artigo of articlesIndex.slice(0, 3)) {
      expect(screen.getByRole('heading', { level: 2, name: artigo.title })).toBeInTheDocument()
    }
  })

  it('navigates to the article route when a card is clicked', async () => {
    const user = userEvent.setup()
    renderArtigos()

    const [first] = articlesIndex
    await user.click(screen.getByRole('heading', { level: 2, name: first.title }))

    expect(screen.getByText(`artigo: ${first.id}`)).toBeInTheDocument()
  })
})
