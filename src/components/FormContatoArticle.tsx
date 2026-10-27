import FormContato from './FormContato';
import styles from './css/FormContatoArticle.module.css';

function FormContatoArticle() {
    return (
        <section className={styles.container} aria-labelledby="form-contato-article-heading">
            <h2 id="form-contato-article-heading" className={styles.title}>
                Quer saber mais? Entre em contato hoje!
            </h2>
            <p className={styles.lead}>
                Fale com a nossa equipe para tirar dúvidas ou pedir oração. Estamos prontos para ajudar.
            </p>
            <div className={styles.card}>
                <div className={styles.art}>
                    <img
                        draggable="false"
                        className={styles.illustration}
                        src="/sent_message_article.webp"
                        alt="Contact message"
                    />
                </div>
                <div className={styles.formContent}>
                    <FormContato />
                </div>
            </div>
        </section>
    );
}

export default FormContatoArticle;
