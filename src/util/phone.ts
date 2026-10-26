/** The area codes (DDD) in use in Brazil. */
const BRAZIL_AREA_CODES = new Set([
    11, 12, 13, 14, 15, 16, 17, 18, 19,
    21, 22, 24, 27, 28,
    31, 32, 33, 34, 35, 37, 38,
    41, 42, 43, 44, 45, 46, 47, 48, 49,
    51, 53, 54, 55,
    61, 62, 63, 64, 65, 66, 67, 68, 69,
    71, 73, 74, 75, 77, 79,
    81, 82, 83, 84, 85, 86, 87, 88, 89,
    91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export const PHONE_INVALID_MESSAGE = 'Digite um telefone válido com DDD.';

export function normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
}

/**
 * A Brazilian phone with its area code, as digits: a mobile (DDD + 9 + 8 digits)
 * or a landline (DDD + 8 digits starting with 2 to 5).
 */
export function isValidBrazilPhone(digits: string): boolean {
    if (!BRAZIL_AREA_CODES.has(Number(digits.slice(0, 2)))) {
        return false;
    }
    return /^\d{2}9\d{8}$/.test(digits) || /^\d{2}[2-5]\d{7}$/.test(digits);
}

/** Input mask: keeps up to 11 digits as `(21) 2345-6789` or `(21) 98765-4321` while typing. */
export function maskPhone(value: string): string {
    const digits = normalizePhone(value).slice(0, 11);
    if (digits.length === 0) {
        return '';
    }
    if (digits.length <= 2) {
        return `(${digits}`;
    }
    const areaCode = `(${digits.slice(0, 2)}) `;
    const number = digits.slice(2);
    if (number.length <= 4) {
        return areaCode + number;
    }
    const split = number.length === 9 ? 5 : 4;
    return `${areaCode}${number.slice(0, split)}-${number.slice(split)}`;
}

/** `21987654321` → `(21) 98765-4321`; anything that is not a full number is returned as typed. */
export function formatPhone(phone: string): string {
    const digits = normalizePhone(phone);
    return digits.length === 10 || digits.length === 11 ? maskPhone(digits) : phone;
}
