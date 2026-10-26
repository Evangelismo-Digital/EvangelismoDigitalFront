import { quemSomosText } from "../templates/QuemSomosText";
import styles from './css/QuemSomos.module.css';

const QuemSomos = ({
  href
} : { 
  href?: string 
}) => {
  return (
    <div className="container">
      <div className={`${styles.card} ${styles.cardWithArrow}`}>
        <div className={styles.cardContent + " d-flex flex-column justify-content-center mt-4"}>
          <h2 className={styles.title + " text-center"}>
            Quem Somos
          </h2>
          <p className={styles.text}>{quemSomosText}</p>
        </div>
        <div className={styles.arrow}>
          <a href={href ? href : "#"} aria-label="Ir para baixo">
            <img
              src="/arrow_down.svg"
              alt="seta para baixo"
              className={styles.arrowImage}
            />
          </a>
        </div>
      </div>
    </div>
  );
}

export default QuemSomos;