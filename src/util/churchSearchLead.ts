import { formatCep } from './nearestChurchesApi';
import { postToWeb3Forms, Web3FormsResponse } from './web3forms';
import { TRAVEL_MODES, TravelMode } from './travelMode';
import { formatPhone } from './phone';

export const NO_CHURCH_FOUND_TEXT = 'nenhuma encontrada';

export const NO_PHONE_TEXT = 'não informado';

export interface ChurchSearchLead {
    email: string;
    /** Digits only; empty when not given. */
    phone: string;
    cep: string;
    mode: TravelMode;
    /** `null` when the search failed or found nothing. */
    nearestChurchName: string | null;
}

export function buildChurchSearchLeadFields(lead: ChurchSearchLead): Record<string, string> {
    const cep = formatCep(lead.cep);
    const nearestChurch = lead.nearestChurchName ?? NO_CHURCH_FOUND_TEXT;
    const travel = TRAVEL_MODES[lead.mode].distanceSuffix;
    const phone = lead.phone ? formatPhone(lead.phone) : NO_PHONE_TEXT;

    return {
        subject: `Busca de igreja - CEP ${cep}`,
        from_name: 'Evangelismo Digital',
        email: lead.email,
        telefone: phone,
        cep,
        como_vai: travel,
        igreja_mais_proxima: nearestChurch,
        message: `Nova busca de igreja pelo site Evangelismo Digital:\n\nEmail: ${lead.email}\nTelefone: ${phone}\nCEP: ${cep}\nComo vai: ${travel}\nIgreja mais próxima: ${nearestChurch}`,
    };
}

export function sendChurchSearchLead(lead: ChurchSearchLead): Promise<Web3FormsResponse> {
    return postToWeb3Forms(buildChurchSearchLeadFields(lead));
}
