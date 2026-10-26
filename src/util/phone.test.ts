import { describe, expect, it } from 'vitest'
import { PHONE_INVALID_MESSAGE, formatPhone, isValidBrazilPhone, maskPhone, normalizePhone } from './phone'

describe('normalizePhone', () => {
  it('keeps only the digits', () => {
    expect(normalizePhone('(21) 98765-4321')).toBe('21987654321')
  })
})

describe('isValidBrazilPhone', () => {
  it.each(['21987654321', '11912345678', '99987654321', '2123456789', '2133456789', '2143456789', '2153456789'])('accepts %s', (digits) => {
    expect(isValidBrazilPhone(digits)).toBe(true)
  })

  it.each([
    ['an unused area code', '20987654321'],
    ['area code 10', '1023456789'],
    ['a landline starting with 6', '2163456789'],
    ['a landline starting with 9', '2193456789'],
    ['a 10-digit number starting with 1', '2113456789'],
    ['an 11-digit number not starting with 9', '21887654321'],
    ['too short', '219876543'],
    ['too long', '219876543210'],
    ['empty', ''],
    ['letters', '21abcdefgh'],
    ['extra characters around a valid number', 'x21987654321'],
    ['extra characters after a valid number', '21987654321x'],
    ['a landline with trailing characters', '2123456789x'],
    ['a landline with leading characters', 'x2123456789'],
    ['a mobile behind another area code', '2121987654321'],
    ['a landline behind another area code', '212123456789'],
  ])('rejects %s', (_, digits) => {
    expect(isValidBrazilPhone(digits)).toBe(false)
  })

  it('has a pt-BR message', () => {
    expect(PHONE_INVALID_MESSAGE).toBe('Digite um telefone válido com DDD.')
  })
})

describe('maskPhone', () => {
  it.each([
    ['', ''],
    ['abc', ''],
    ['2', '(2'],
    ['21', '(21'],
    ['219', '(21) 9'],
    ['212345', '(21) 2345'],
    ['2123456', '(21) 2345-6'],
    ['2123456789', '(21) 2345-6789'],
    ['21987654321', '(21) 98765-4321'],
    ['219876543210', '(21) 98765-4321'],
    ['(21) 98765-4321', '(21) 98765-4321'],
  ])('masks %j as %j', (value, masked) => {
    expect(maskPhone(value)).toBe(masked)
  })
})

describe('formatPhone', () => {
  it('formats a mobile and a landline', () => {
    expect(formatPhone('21987654321')).toBe('(21) 98765-4321')
    expect(formatPhone('2123456789')).toBe('(21) 2345-6789')
  })

  it('returns anything else as typed', () => {
    expect(formatPhone('21 9876')).toBe('21 9876')
    expect(formatPhone('219876543210')).toBe('219876543210')
  })
})
