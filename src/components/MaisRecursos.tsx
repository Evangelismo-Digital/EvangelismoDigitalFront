import styles from './css/MaisRecursos.module.css';

type Recurso = {
    title: string;
    domain: string;
    url: string;
    tag: string;
    description: string;
    icon: 'ia' | 'artigos';
};

const recursos: Recurso[] = [
    {
        title: 'Apologist AI',
        domain: 'apologist.ai',
        url: 'https://apologist.ai/',
        tag: 'Inteligência artificial',
        description:
            'Uma inteligência artificial de apologética: faça suas perguntas sobre fé, dúvidas e objeções e receba respostas fundamentadas na Bíblia e na razão.',
        icon: 'ia',
    },
    {
        title: 'Reasonable Faith',
        domain: 'pt.reasonablefaith.org',
        url: 'https://pt.reasonablefaith.org/artigos/',
        tag: 'Artigos em português',
        description:
            'Acervo de artigos sobre a existência de Deus, a ressurreição de Cristo e as grandes questões da filosofia e da fé, tudo em português.',
        icon: 'artigos',
    },
];

const icons = {
    ia: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            <path d="m12 8.2.85 1.95 1.95.85-1.95.85L12 13.8l-.85-1.95-1.95-.85 1.95-.85z" />
        </svg>
    ),
    artigos: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <path d="M9 7h7M9 11h5" />
        </svg>
    ),
};

const MaisRecursos = () => {
    return (
        <section className={styles.section} aria-labelledby="mais-recursos-title">
            <h2 id="mais-recursos-title" className={styles.title}>
                Mais recursos
            </h2>
            <p className={styles.subtitle}>
                Outros lugares de confiança para continuar buscando respostas.
            </p>

            <div className={styles.grid}>
                {recursos.map((recurso) => (
                    <a
                        key={recurso.url}
                        className={styles.card}
                        href={recurso.url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <span className={styles.cardIcon} aria-hidden="true">
                            {icons[recurso.icon]}
                        </span>

                        <div className={styles.cardBody}>
                            <span className={styles.tag}>{recurso.tag}</span>
                            <h3 className={styles.cardTitle}>{recurso.title}</h3>
                            <span className={styles.domain}>{recurso.domain}</span>
                            <p className={styles.description}>{recurso.description}</p>
                        </div>

                        <span className={styles.action}>
                            Acessar recurso
                            <svg
                                className={styles.actionIcon}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M7 17 17 7M9 7h8v8" />
                            </svg>
                            <span className={styles.visuallyHidden}>(abre em uma nova aba)</span>
                        </span>
                    </a>
                ))}
            </div>
        </section>
    );
};

export default MaisRecursos;
