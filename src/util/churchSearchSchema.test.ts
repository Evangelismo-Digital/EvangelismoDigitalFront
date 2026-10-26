import { describe, expect, it } from 'vitest'
import { churchSearchSchema } from './churchSearchSchema'

const issues = (input: unknown) => {
  const result = churchSearchSchema.safeParse(input)
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]))
}

describe('churchSearchSchema', () => {
  it('normalizes the CEP to digits', () => {
    expect(churchSearchSchema.parse({ mode: 'pedestrian', cep: '24020-085', email: 'maria@email.com', phone: '' })).toEqual({ mode: 'pedestrian', cep: '24020085', email: 'maria@email.com', phone: '' })
  })

  it('trims and lowercases a provided email', () => {
    expect(churchSearchSchema.parse({ mode: 'pedestrian', cep: '24020085', email: '  Maria@Email.COM ', phone: '' })).toEqual({ mode: 'pedestrian', cep: '24020085', email: 'maria@email.com', phone: '' })
  })

  it.each(['', '   '])('requires the email (%j), with one message', (email) => {
    expect(issues({ mode: 'pedestrian', cep: '24020085', email, phone: '' })).toEqual({ email: 'Digite seu email.' })
    expect(churchSearchSchema.safeParse({ mode: 'pedestrian', cep: '24020085', email, phone: '' }).error?.issues).toHaveLength(1)
  })

  it('accepts the transport mode', () => {
    expect(churchSearchSchema.parse({ mode: 'transport', cep: '24020085', email: 'maria@email.com', phone: '' }).mode).toBe('transport')
  })

  it.each([undefined, 'bicycle', ''])('rejects travel mode %j', (mode) => {
    expect(churchSearchSchema.safeParse({ mode, cep: '24020085', email: 'maria@email.com', phone: '' }).success).toBe(false)
  })

  it('requires the CEP', () => {
    expect(issues({ mode: 'pedestrian', cep: '', email: 'maria@email.com', phone: '' })).toEqual({ cep: 'Digite seu CEP.' })
  })

  it.each(['2402008', '240200851', 'abcde-fgh', '24020-08'])('rejects CEP %s', (cep) => {
    expect(issues({ mode: 'pedestrian', cep, email: 'maria@email.com', phone: '' })).toEqual({ cep: 'CEP deve ter 8 dígitos.' })
  })

  it.each(['maria', 'maria@', '@email.com', 'maria@email'])('rejects email %s', (email) => {
    expect(issues({ mode: 'pedestrian', cep: '24020085', email, phone: '' })).toEqual({ email: 'Digite um email válido.' })
  })

  it.each(['', '(  ) -'])('accepts a blank phone (%j) as empty', (phone) => {
    expect(churchSearchSchema.parse({ mode: 'pedestrian', cep: '24020085', email: 'maria@email.com', phone }).phone).toBe('')
  })

  it.each([['(21) 98765-4321', '21987654321'], ['(21) 2345-6789', '2123456789']])('keeps phone %s as digits', (phone, digits) => {
    expect(churchSearchSchema.parse({ mode: 'pedestrian', cep: '24020085', email: 'maria@email.com', phone }).phone).toBe(digits)
  })

  it('requires the phone key, which the form always provides', () => {
    expect(churchSearchSchema.safeParse({ mode: 'pedestrian', cep: '24020085', email: 'maria@email.com' }).success).toBe(false)
  })

  it.each(['(21) 9876-543', '(20) 98765-4321', '(21) 6345-6789'])('rejects phone %s', (phone) => {
    expect(issues({ mode: 'pedestrian', cep: '24020085', email: 'maria@email.com', phone })).toEqual({ phone: 'Digite um telefone válido com DDD.' })
  })
})
