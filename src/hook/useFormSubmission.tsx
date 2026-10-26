import { useMutation } from "@tanstack/react-query";
import { FormSubmissionData } from "../interface/FormSubmissionData";
import { postToWeb3Forms, Web3FormsResponse } from "../util/web3forms";
import { formatPhone } from "../util/phone";

const formSubmission = async (formData: FormSubmissionData): Promise<Web3FormsResponse> => {
    const phone = formData.phone ? formatPhone(formData.phone) : "";
    return postToWeb3Forms({
        subject: `Novo contato - ${formData.name} ${formData.lastName}`,
        from_name: "Evangelismo Digital",
        name: `${formData.name} ${formData.lastName}`,
        email: formData.email,
        telefone: phone || "Não informado",
        decisao_por_cristo: formData.decisaoPorCristo ? "Sim" : "Não",
        localizacao: formData.location || "Não informada",
        message: `Novo contato recebido através do site Evangelismo Digital:\n\nNome: ${formData.name} ${formData.lastName}\nEmail: ${formData.email}${phone ? `\nTelefone: ${phone}` : ""}\nDecisão por Cristo: ${formData.decisaoPorCristo ? "Sim" : "Não"}${formData.location ? `\nLocalização: ${formData.location}` : ""}`,
    });
};

const useFormSubmission = () => {
    return useMutation({
        mutationFn: (formData: FormSubmissionData) => formSubmission(formData),
    });
};

export default useFormSubmission;
