import styles from "./css/FormContato.module.css"
import { useForm, Resolver } from "react-hook-form";
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from "react";
import FormContatoSuccess from "./FormContatoSuccess";
import useFormSubmission from "../hook/useFormSubmission";
import { FormSubmissionData } from "../interface/FormSubmissionData";
import FormContatoError from "./FormContatoError";

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
  decisaoPorCristo: z.boolean().optional(),
});

export type FormContatoData = z.infer<typeof formContatoSchema>;

function FormContato(){
    const [successData, setSuccessData] = useState<FormContatoData | null>(null);
    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

    const { register, handleSubmit, formState:{ errors }, reset } = useForm<FormContatoData>({
        resolver: zodResolver(formContatoSchema) as Resolver<FormContatoData>,
        mode: 'onBlur',
        reValidateMode: 'onChange',
        defaultValues: { name: '', lastName: '', email: '', decisaoPorCristo: false },
    });

    const submission = useFormSubmission();

    async function handleFormContato(data: FormContatoData) {
        const payload: FormSubmissionData = {
            name: data.name,
            lastName: data.lastName,
            email: data.email,
            decisaoPorCristo: !!data.decisaoPorCristo,
            location: '',
        };

        try {
            await submission.mutateAsync(payload);
            reset();
            setSuccessData(data);
            setShowError(false);
            setErrorMessage(undefined);
        } catch (err: unknown) {
            console.error("Error submitting form: ", err);
            setShowError(true);
            setErrorMessage(err instanceof Error ? err.message : undefined);
        }
    }

    return (
        <>
            <div className={styles.formcontato}>
                <form onSubmit={handleSubmit(handleFormContato)} name="form" noValidate>
                    <label>
                        Nome: <input type="text" {...register('name') }/>
                    </label>
                    {
                        <p className={styles.errorMessage}>
                            {errors.name ? String(errors.name.message) : "\u00A0"}
                        </p>
                    }
                    <label>
                        Sobrenome: <input type="text" {...register('lastName') }/>
                    </label>
                    {
                        <p className={styles.errorMessage}>
                            {errors.lastName ? String(errors.lastName.message) : "\u00A0"}
                        </p>
                    }
                    <label>
                        Email: <input type="email" {...register('email')} />
                    </label>
                    {
                        <p className={styles.errorMessage}>
                            {errors.email ? String(errors.email.message) : "\u00A0"}
                        </p>
                    }
                    <label className={styles.checkboxLabel}>
                        <input type="checkbox" className={styles.checkboxInput} {...register('decisaoPorCristo')}/>
                        Tomou uma decisão por Jesus hoje? Clique aqui.
                    </label>
                    <button type="submit" disabled={submission.isPending}>
                        {submission.isPending ? 'Enviando...' : 'Enviar'}
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
    )
}

export default FormContato;

