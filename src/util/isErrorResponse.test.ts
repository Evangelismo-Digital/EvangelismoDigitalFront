import { describe, expect, it } from 'vitest'
import isErrorResponse from './isErrorResponse'

describe('isErrorResponse', () => {
  it('accepts the backend { message, code } body', () => {
    expect(isErrorResponse({ message: 'Nenhuma igreja encontrada nas proximidades.', code: 'NO_NEARBY_CHURCHES_FOUND' })).toBe(true)
  })

  it.each([
    ['missing code', { message: 'erro' }],
    ['missing message', { code: 'INVALID_CEP' }],
    ['non-string code', { message: 'erro', code: 404 }],
    ['non-string message', { message: null, code: 'INVALID_CEP' }],
    ['an Error instance', new Error('falha')],
    ['a string', 'erro'],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s', (_label, value) => {
    expect(isErrorResponse(value)).toBe(false)
  })
})
