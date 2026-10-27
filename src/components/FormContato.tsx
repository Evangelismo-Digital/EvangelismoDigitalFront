import styles from "./css/FormContato.module.css";
import { useForm, Resolver } from "react-hook-form";
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from "react";
import FormContatoSuccess from "./FormContatoSuccess";
import useFormSubmission from "../hook/useFormSubmission";
import { track } from "../analytics/analytics";
import { contactFormStartEvent, contactFormSubmitEvent } from "../analytics/events";
import { FormSubmissionData } from "../interface/FormSubmissionData";
import FormContatoError from "./FormContatoError";
import { PHONE_INVALID_MESSAGE, isValidBrazilPhone, maskPhone, normalizePhone } from "../util/phone";
import { MailIcon, PhoneIcon, SendIcon, UserIcon } from "./FormContatoIcons";

const DEFAULT_AUTO_DISMISS_SUCCESS_MS = 5000;

const formContatoSchema = z.object({
  name: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.string().nonempty("Digite um nome.").min(2, "Digite um nome válido.")
  ),
  lastName: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.string().nonempty("Digite um sobrenome.").min(2, "Digite um sobrenome válido.")
  ),
  email: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
    z.string().nonempty("Digite um email.").email("Digite um email válido.")
  ),
  // Optional: blank is accepted, anything typed must be a Brazilian number with its area code.
  phone: z.string()
    .transform(normalizePhone)
    .refine((val) => val === '' || isValidBrazilPhone(val), PHONE_INVALID_MESSAGE),
  decisaoPorCristo: z.boolean().optional(),
});

export type FormContatoData = z.infer<typeof formContatoSchema>;

function FormContato() {
    const fieldId = 'form-contato';
    const [successData, setSuccessData] = useState<FormContatoData | null>(null);
    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

    const { register, handleSubmit, formState: { errors }, reset } = useForm<FormContatoData>({
        resolver: zodResolver(formContatoSchema) as Resolver<FormContatoData>,
        mode: 'onBlur',
        reValidateMode: 'onChange',
        // Stryker disable next-line ObjectLiteral: register() reads the blank, unchecked inputs from the DOM without defaults
        defaultValues: { name: '', lastName: '', email: '', phone: '', decisaoPorCristo: false },
    });

    const phoneField = register('phone');
    const submission = useFormSubmission();
    // One `form_start` per filling-in, on the first keystroke; analytics only runs with consent.
    const started = useRef(false);
    const onFormInput = () => {
        if (!started.current) {
            started.current = true;
            track(contactFormStartEvent(window.location.pathname));
        }
    };

    async function handleFormContato(data: FormContatoData) {
        const payload: FormSubmissionData = {
            name: data.name,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            decisaoPorCristo: !!data.decisaoPorCristo,
            location: '',
        };

        try {
            await submission.mutateAsync(payload);
            track(contactFormSubmitEvent(window.location.pathname, true));
            started.current = false;
            reset();
            setSuccessData(data);
            setShowError(false);
            setErrorMessage(undefined);
        } catch (err: unknown) {
            console.error("Error submitting form: ", err);
            track(contactFormSubmitEvent(window.location.pathname, false));
            setShowError(true);
            setErrorMessage(err instanceof Error ? err.message : undefined);
        }
    }

    return (
        <>
            <div className={styles.formcontato}>
                <form onSubmit={handleSubmit(handleFormContato)} onInput={onFormInput} name="form" noValidate>
                    <label className={styles.field} htmlFor={`${fieldId}-name`}>
                        <span className={styles.label}>Nome:</span>
                        <div className={styles.inputWrap}>
                            <UserIcon />
                            <input
                                id={`${fieldId}-name`}
                                type="text"
                                placeholder="Seu nome"
                                autoComplete="given-name"
                                className={styles.input}
                                aria-required="true"
                                aria-invalid={errors.name ? true : undefined}
                                aria-describedby={errors.name ? `${fieldId}-name-error` : undefined}
                                {...register('name')}
                            />
                        </div>
                    </label>
                    <p
                        id={`${fieldId}-name-error`}
                        className={styles.errorMessage}
                        role={errors.name ? 'alert' : undefined}
                    >
                        {errors.name ? String(errors.name.message) : "\u00A0"}
                    </p>

                    <label className={styles.field} htmlFor={`${fieldId}-lastname`}>
                        <span className={styles.label}>Sobrenome:</span>
                        <div className={styles.inputWrap}>
                            <UserIcon />
                            <input
                                id={`${fieldId}-lastname`}
                                type="text"
                                placeholder="Seu sobrenome"
                                autoComplete="family-name"
                                className={styles.input}
                                aria-required="true"
                                aria-invalid={errors.lastName ? true : undefined}
                                aria-describedby={errors.lastName ? `${fieldId}-lastname-error` : undefined}
                                {...register('lastName')}
                            />
                        </div>
                    </label>
                    <p
                        id={`${fieldId}-lastname-error`}
                        className={styles.errorMessage}
                        role={errors.lastName ? 'alert' : undefined}
                    >
                        {errors.lastName ? String(errors.lastName.message) : "\u00A0"}
                    </p>

                    <label className={styles.field} htmlFor={`${fieldId}-email`}>
                        <span className={styles.label}>Email:</span>
                        <div className={styles.inputWrap}>
                            <MailIcon />
                            <input
                                id={`${fieldId}-email`}
                                type="email"
                                placeholder="seu@email.com"
                                autoComplete="email"
                                className={styles.input}
                                aria-required="true"
                                aria-invalid={errors.email ? true : undefined}
                                aria-describedby={errors.email ? `${fieldId}-email-error` : undefined}
                                {...register('email')}
                            />
                        </div>
                    </label>
                    <p
                        id={`${fieldId}-email-error`}
                        className={styles.errorMessage}
                        role={errors.email ? 'alert' : undefined}
                    >
                        {errors.email ? String(errors.email.message) : "\u00A0"}
                    </p>

                    <label className={styles.field} htmlFor={`${fieldId}-phone`}>
                        <span className={styles.label}>{'Telefone (opcional): '}</span>
                        <div className={styles.inputWrap}>
                            <PhoneIcon />
                            <input
                                id={`${fieldId}-phone`}
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel-national"
                                placeholder="(21) 98765-4321"
                                maxLength={15}
                                className={styles.input}
                                aria-invalid={errors.phone ? true : undefined}
                                aria-describedby={errors.phone ? `${fieldId}-phone-error` : undefined}
                                {...phoneField}
                                onChange={(event) => {
                                    event.target.value = maskPhone(event.target.value);
                                    return phoneField.onChange(event);
                                }}
                            />
                        </div>
                    </label>
                    <p
                        id={`${fieldId}-phone-error`}
                        className={styles.errorMessage}
                        role={errors.phone ? 'alert' : undefined}
                    >
                        {errors.phone ? String(errors.phone.message) : "\u00A0"}
                    </p>

                    <label className={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            className={styles.checkboxInput}
                            {...register('decisaoPorCristo')}
                        />
                        <span className={styles.checkboxText}>
                            Tomou uma decisão por Jesus hoje? Clique aqui.
                        </span>
                    </label>

                    <button
                        type="submit"
                        className={styles.submitButton}
                        disabled={submission.isPending}
                    >
                        {submission.isPending ? (
                            <>
                                <span className={styles.buttonSpinner} aria-hidden="true" />
                                <span>Enviando...</span>
                            </>
                        ) : (
                            <>
                                <SendIcon />
                                <span>Enviar</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
            
            {successData && (
                <FormContatoSuccess 
                    data={successData}
                    onClose={() => setSuccessData(null)}
                    autoDismissMs={DEFAULT_AUTO_DISMISS_SUCCESS_MS}
                />
            )}

            {showError && (
                <FormContatoError 
                    message={errorMessage}
                    onClose={() => setShowError(false)}
                />
            )}
        </>
    );
}

export default FormContato;
