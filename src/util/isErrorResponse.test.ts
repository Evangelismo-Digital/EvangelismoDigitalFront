import { describe, expect, it } from 'vitest'
import isErrorResponse from './isErrorResponse'

describe('isErrorResponse', () => {
  it('accepts objects with a string requestURI', () => {
    expect(isErrorResponse({ requestURI: '/forms/submit-form', message: 'erro' })).toBe(true)
  })

  it('rejects values without a string requestURI', () => {
    expect(isErrorResponse({ requestURI: 42 })).toBe(false)
    expect(isErrorResponse(new Error('falha'))).toBe(false)
    expect(isErrorResponse(null)).toBe(false)
    expect(isErrorResponse(undefined)).toBe(false)
  })
})
