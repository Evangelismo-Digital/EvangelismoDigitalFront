import { useMutation } from "@tanstack/react-query";
import { WEB3FORMS_ACCESS_KEY } from "../config/api";
import { FormSubmissionData } from "../interface/FormSubmissionData";

interface Web3FormsResponse {
    success: boolean;
    message: string;
}

const formSubmission = async (formData: FormSubmissionData): Promise<Web3FormsResponse> => {
    if (!WEB3FORMS_ACCESS_KEY) {
        throw new Error("Chave do Web3Forms não configurada no ambiente (CONFIG_WEB3FORMS_ACCESS_KEY).");
    }

    const payload = {
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: `Novo contato - ${formData.name} ${formData.lastName}`,
        from_name: "Evangelismo Digital",
        name: `${formData.name} ${formData.lastName}`,
        email: formData.email,
        decisao_por_cristo: formData.decisaoPorCristo ? "Sim" : "Não",
        localizacao: formData.location || "Não informada",
        message: `Novo contato recebido através do site Evangelismo Digital:\n\nNome: ${formData.name} ${formData.lastName}\nEmail: ${formData.email}\nDecisão por Cristo: ${formData.decisaoPorCristo ? "Sim" : "Não"}${formData.location ? `\nLocalização: ${formData.location}` : ""}`,
    };

    const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(payload),
    });

    const result: Web3FormsResponse = await response.json().catch(() => ({
        success: false,
        message: "Erro ao processar resposta do servidor.",
    }));

    if (!response.ok || !result.success) {
        console.error("Web3Forms error response:", result);
        throw new Error(result.message || "Erro ao enviar formulário. Tente novamente mais tarde.");
    }

    return result;
};

const useFormSubmission = () => {
    return useMutation({
        mutationFn: (formData: FormSubmissionData) => formSubmission(formData),
    });
};

export default useFormSubmission;