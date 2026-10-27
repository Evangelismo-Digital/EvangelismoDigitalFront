import FormContato from './FormContato';
import styles from './../components/css/FormContatoHome.module.css';

function FormContatoHome() {
    return (
        <section className={styles.container} aria-labelledby="form-contato-heading">
            <h2 id="form-contato-heading" className={styles.title}>
                Gostaria de entrar em contato conosco?
            </h2>
            <p className={styles.lead}>
                Envie uma mensagem para a nossa equipe. Teremos prazer em conversar com você e responder suas dúvidas.
            </p>
            <div className={styles.card}>
                <div className={styles.art}>
                    <img
                        draggable="false"
                        className={styles.illustration}
                        src="sent_message.webp"
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

export default FormContatoHome;
