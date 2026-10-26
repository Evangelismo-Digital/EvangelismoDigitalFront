// DRAFT pending legal review (docs/cookie-consent-analytics-plan.md, Phase 0): written from what the
// site and the backend actually do; have it reviewed before publishing.
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import styles from './css/PrivacyPage.module.css';
import { useAnalyticsConsent } from '../analytics/consentContext';

const PRIVACY_POLICY_UPDATED = '25 de outubro de 2026';

const COOKIES = [
    {
        name: 'ed_consent',
        purpose: 'Guarda a sua escolha (aceitar ou recusar) para não perguntarmos de novo a cada visita.',
        duration: '12 meses',
        when: 'Quando você escolhe uma opção',
    },
    {
        name: '__Host-ed_vid',
        purpose: 'Reconhece este navegador entre visitas, por meio de um código aleatório que não contém nome, e-mail ou outro dado seu.',
        duration: '395 dias desde a última visita',
        when: 'Somente se você aceitar',
    },
    {
        name: '__Host-ed_sid',
        purpose: 'Agrupa as páginas lidas numa mesma visita.',
        duration: '30 minutos sem atividade',
        when: 'Somente se você aceitar',
    },
];

function PrivacyPage() {
    const { openPreferences } = useAnalyticsConsent();

    return (
        <>
            <SEO
                title="Política de privacidade"
                description="Como o Evangelismo Digital usa cookies e trata dados pessoais, e como você pode mudar sua escolha a qualquer momento."
                url="/privacidade"
                ogType="website"
                schemaType="WebPage"
            />

            <article className={styles.page}>
                <h1>Política de privacidade</h1>
                {/* One text node: "text {value}" would be two, which the prerendered HTML merges (React #418). */}
                <p className={styles.updated}>{`Última atualização: ${PRIVACY_POLICY_UPDATED}`}</p>

                <p>
                    Esta política explica quais dados o site <strong>Evangelismo Digital</strong> (findhope.digital)
                    coleta, para quê, por quanto tempo e como você pode mudar suas escolhas, de acordo com a Lei Geral
                    de Proteção de Dados (Lei nº 13.709/2018, LGPD).
                </p>

                <h2>Cookies</h2>
                <p>
                    Usamos apenas cookies próprios, sem cookies de publicidade ou de redes sociais. Os cookies de medição
                    só são criados se você clicar em “Aceitar” no aviso de cookies. Se você recusar, ou se o seu
                    navegador enviar o sinal Global Privacy Control, nenhum deles é criado.
                </p>
                {/* Scrolls sideways on phones, so keyboard users can reach it too. */}
                <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Cookies usados neste site">
                    <table className={styles.table}>
                        <caption>Cookies usados neste site</caption>
                        <thead>
                            <tr>
                                <th scope="col">Cookie</th>
                                <th scope="col">Para que serve</th>
                                <th scope="col">Duração</th>
                                <th scope="col">Quando é criado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {COOKIES.map((cookie) => (
                                <tr key={cookie.name}>
                                    <th scope="row"><code>{cookie.name}</code></th>
                                    <td>{cookie.purpose}</td>
                                    <td>{cookie.duration}</td>
                                    <td>{cookie.when}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h2>O que medimos, se você aceitar</h2>
                <ul>
                    <li>As páginas e os artigos que você abre, por quanto tempo os lê (só enquanto a aba está visível) e até onde rola a página.</li>
                    <li>Nas buscas de igrejas: se você vai a pé ou de carro e se encontramos igrejas. O CEP não entra nessa medição.</li>
                    <li>Cliques em links que levam a outros sites (como o Google Maps): registramos apenas o site de destino.</li>
                    <li>No formulário de contato: que ele foi iniciado e enviado, nunca o que você escreveu.</li>
                    <li>
                        Dados técnicos da visita: tipo de navegador, sistema e aparelho, idioma, a página de entrada, o
                        site de onde você veio e parâmetros de campanha (utm). O endereço IP é gravado já reduzido: a
                        parte final é descartada antes, o que impede identificar a sua conexão.
                    </li>
                </ul>
                <p>
                    Usamos essas informações somente para entender quais conteúdos ajudam as pessoas e melhorar o site.
                    Não as vendemos e não as usamos para publicidade.
                </p>

                <h2>Outros dados que você nos envia</h2>
                <ul>
                    <li>
                        <strong>Busca de igrejas:</strong> o CEP, o e-mail e, se você quiser, o telefone que você informa são enviados à nossa equipe
                        para que possamos ajudar você a conhecer uma igreja. O envio usa o serviço Web3Forms.
                    </li>
                    <li>
                        <strong>Formulário de contato:</strong> nome, sobrenome, e-mail, telefone (se informado) e as informações que você escolher
                        enviar chegam à nossa equipe pelo mesmo serviço.
                    </li>
                    <li>
                        <strong>Resultados da busca no seu navegador:</strong> para agilizar novas buscas, as igrejas
                        encontradas ficam guardadas no armazenamento local do seu navegador (não é um cookie e não é
                        enviado a ninguém) por até 7 dias.
                    </li>
                    <li>
                        <strong>Fontes do site:</strong> para exibir a tipografia, o navegador baixa arquivos do Google
                        Fonts, que recebe o endereço IP de quem acessa.
                    </li>
                </ul>

                <h2>Base legal</h2>
                <p>
                    Os cookies de medição dependem do seu consentimento (art. 7º, I, da LGPD), que você pode retirar a
                    qualquer momento. Os dados dos formulários são tratados para atender ao pedido que você mesmo faz ao
                    enviá-los.
                </p>

                <h2>Por quanto tempo guardamos</h2>
                <ul>
                    <li>Registros de páginas lidas e de visitas: até 425 dias.</li>
                    <li>O identificador do navegador: apagado após 395 dias sem nenhuma visita.</li>
                    <li>A sua escolha sobre cookies: 12 meses, depois perguntamos de novo.</li>
                </ul>

                <h2>Como mudar sua escolha</h2>
                <p>
                    A qualquer momento, em “Preferências de cookies”, no rodapé de todas as páginas. Se você recusar
                    depois de ter aceitado, apagamos os cookies de medição deste navegador e os dados de medição ligados a
                    ele.
                </p>
                <p>
                    <button type="button" className={styles.preferencesButton} onClick={openPreferences}>
                        Preferências de cookies
                    </button>
                </p>

                <h2>Seus direitos</h2>
                <p>
                    {'Pela LGPD, você pode pedir a confirmação de que tratamos seus dados, o acesso a eles, a ' +
                        'correção, a anonimização ou a eliminação, informações sobre com quem os compartilhamos e a ' +
                        'revogação do consentimento. Para isso, escreva para nós pelo '}
                    <Link to="/?section=contato">formulário de contato</Link>.
                </p>

                <h2>Com quem compartilhamos</h2>
                <p>
                    Somente com os serviços que fazem o site funcionar: a hospedagem do site e da nossa API, o Web3Forms
                    (envio dos formulários) e o Google Fonts (tipografia). Não vendemos dados pessoais.
                </p>

                <h2>Alterações</h2>
                <p>
                    Se esta política mudar de forma relevante, a data acima será atualizada e, quando a mudança afetar os
                    cookies, pediremos a sua escolha de novo.
                </p>
            </article>
        </>
    );
}

export default PrivacyPage;
