import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import QuemSomos from './QuemSomos'

describe('QuemSomos', () => {
  it('lays out the card and its overlapping arrow with classes, not inline styles (they break dev hydration)', () => {
    const { container } = render(<QuemSomos href="#contatosRef" />)

    const card = container.querySelector('.card')!
    expect(card).toHaveClass('card', 'cardWithArrow')
    const arrow = screen.getByRole('img', { name: 'seta para baixo' })
    expect(arrow).toHaveClass('arrowImage')
    expect(arrow.parentElement!.parentElement).toHaveClass('arrow')
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
    expect(screen.getByRole('link', { name: 'Ir para baixo' })).toHaveAttribute('href', '#contatosRef')
  })
})
