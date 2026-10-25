import { z } from 'zod';
import { normalizeCep } from './nearestChurchesApi';

// Schema for the church search form: travel mode, CEP and email all required
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
});

export type ChurchSearchInput = z.input<typeof churchSearchSchema>;
export type ChurchSearchData = z.output<typeof churchSearchSchema>;
