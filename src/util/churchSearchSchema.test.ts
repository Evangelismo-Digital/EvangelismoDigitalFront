import { describe, expect, it } from 'vitest'
import { churchSearchSchema } from './churchSearchSchema'

const issues = (input: unknown) => {
  const result = churchSearchSchema.safeParse(input)
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]))
}

describe('churchSearchSchema', () => {
  it('normalizes the CEP to digits', () => {
    expect(churchSearchSchema.parse({ mode: 'pedestrian', cep: '24020-085', email: 'maria@email.com' })).toEqual({ mode: 'pedestrian', cep: '24020085', email: 'maria@email.com' })
  })

  it('trims and lowercases a provided email', () => {
    expect(churchSearchSchema.parse({ mode: 'pedestrian', cep: '24020085', email: '  Maria@Email.COM ' })).toEqual({ mode: 'pedestrian', cep: '24020085', email: 'maria@email.com' })
  })

  it.each(['', '   '])('requires the email (%j), with one message', (email) => {
    expect(issues({ mode: 'pedestrian', cep: '24020085', email })).toEqual({ email: 'Digite seu email.' })
    expect(churchSearchSchema.safeParse({ mode: 'pedestrian', cep: '24020085', email }).error?.issues).toHaveLength(1)
  })

  it('accepts the transport mode', () => {
    expect(churchSearchSchema.parse({ mode: 'transport', cep: '24020085', email: 'maria@email.com' }).mode).toBe('transport')
  })

  it.each([undefined, 'bicycle', ''])('rejects travel mode %j', (mode) => {
    expect(churchSearchSchema.safeParse({ mode, cep: '24020085', email: 'maria@email.com' }).success).toBe(false)
  })

  it('requires the CEP', () => {
    expect(issues({ mode: 'pedestrian', cep: '', email: 'maria@email.com' })).toEqual({ cep: 'Digite seu CEP.' })
  })

  it.each(['2402008', '240200851', 'abcde-fgh', '24020-08'])('rejects CEP %s', (cep) => {
    expect(issues({ mode: 'pedestrian', cep, email: 'maria@email.com' })).toEqual({ cep: 'CEP deve ter 8 dígitos.' })
  })

  it.each(['maria', 'maria@', '@email.com', 'maria@email'])('rejects email %s', (email) => {
    expect(issues({ mode: 'pedestrian', cep: '24020085', email })).toEqual({ email: 'Digite um email válido.' })
  })
})
