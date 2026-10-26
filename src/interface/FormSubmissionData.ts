export interface FormSubmissionData {
    name: string;
    lastName: string;
    email: string;
    /** Digits only; empty when not given. */
    phone: string;
    decisaoPorCristo: boolean;
    location: string | null;
}