import { z } from 'zod';
import { normalizeCep } from './nearestChurchesApi';
import { PHONE_INVALID_MESSAGE, isValidBrazilPhone, normalizePhone } from './phone';

// Schema for the church search form: travel mode, CEP and email required, phone optional
export const churchSearchSchema = z.object({
    mode: z.enum(['pedestrian', 'transport']),
    cep: z.string()
        .min(1, "Digite seu CEP.")
        .transform(normalizeCep)
        .refine(val => val.length === 8, "CEP deve ter 8 dígitos."),
    email: z.string()
        .transform(val => val.trim().toLowerCase())
        .refine(val => val !== '', "Digite seu email.")
        .refine(val => val === '' || z.string().email().safeParse(val).success, "Digite um email válido."),
    // Blank is accepted; anything typed must be a Brazilian number with its area code. Kept as digits.
    phone: z.string()
        .transform(normalizePhone)
        .refine(val => val === '' || isValidBrazilPhone(val), PHONE_INVALID_MESSAGE),
});

export type ChurchSearchInput = z.input<typeof churchSearchSchema>;
export type ChurchSearchData = z.output<typeof churchSearchSchema>;
