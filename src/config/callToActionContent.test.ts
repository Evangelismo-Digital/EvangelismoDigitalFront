import { describe, expect, it } from 'vitest'
import { callToActionContent, getCallToActionContent } from './callToActionContent'
import { articlesIndex } from '../articleContent/ArticlesIndex'

describe('getCallToActionContent', () => {
  it('returns the article-specific content for a known slug', () => {
    expect(getCallToActionContent('caminhos')).toBe(callToActionContent.caminhos)
  })

  it('falls back to default for a missing or unknown slug', () => {
    expect(getCallToActionContent()).toBe(callToActionContent.default)
    expect(getCallToActionContent('inexistente')).toBe(callToActionContent.default)
  })

  it('has dedicated content for every listed article', () => {
    for (const artigo of articlesIndex) {
      expect(callToActionContent[artigo.id], artigo.id).toBeDefined()
    }
  })
})
