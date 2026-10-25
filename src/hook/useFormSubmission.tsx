import { useMutation } from "@tanstack/react-query";
import { FormSubmissionData } from "../interface/FormSubmissionData";
import { postToWeb3Forms, Web3FormsResponse } from "../util/web3forms";

const formSubmission = async (formData: FormSubmissionData): Promise<Web3FormsResponse> => {
    return postToWeb3Forms({
        subject: `Novo contato - ${formData.name} ${formData.lastName}`,
        from_name: "Evangelismo Digital",
        name: `${formData.name} ${formData.lastName}`,
        email: formData.email,
        decisao_por_cristo: formData.decisaoPorCristo ? "Sim" : "Não",
        localizacao: formData.location || "Não informada",
        message: `Novo contato recebido através do site Evangelismo Digital:\n\nNome: ${formData.name} ${formData.lastName}\nEmail: ${formData.email}\nDecisão por Cristo: ${formData.decisaoPorCristo ? "Sim" : "Não"}${formData.location ? `\nLocalização: ${formData.location}` : ""}`,
    });
};

const useFormSubmission = () => {
    return useMutation({
        mutationFn: (formData: FormSubmissionData) => formSubmission(formData),
    });
};

export default useFormSubmission;
