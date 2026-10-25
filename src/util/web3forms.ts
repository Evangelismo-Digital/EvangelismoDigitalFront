import { WEB3FORMS_ACCESS_KEY } from "../config/api";

export const WEB3FORMS_URL = "https://api.web3forms.com/submit";

export interface Web3FormsResponse {
    success: boolean;
    message: string;
}

/** Posts `fields` to Web3Forms with the site's access key; throws with a pt-BR message on failure. */
export async function postToWeb3Forms(
    fields: Record<string, string>,
    accessKey: string | undefined = WEB3FORMS_ACCESS_KEY,
): Promise<Web3FormsResponse> {
    if (!accessKey) {
        throw new Error("Chave do Web3Forms não configurada no ambiente (CONFIG_WEB3FORMS_ACCESS_KEY).");
    }

    const response = await fetch(WEB3FORMS_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({ access_key: accessKey, ...fields }),
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
}
