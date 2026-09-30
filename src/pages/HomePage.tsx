import Artigos from '../components/Artigos';
import MaisRecursos from '../components/MaisRecursos';
import QuemSomos from '../components/QuemSomos';
import FormContatoHome from '../components/FormContatoHome';
import styles from './css/HomePage.module.css';
import { useEffect, useRef } from 'react';
import SEO from '../components/SEO';
import { seoPresentationText } from '../templates/SEOPresentationText';
import FindNearestChurch from '../components/FindNearestChurch';

type HomePageProps = {
    section?: string;
};

const HomePage = ({ section }: HomePageProps) => {
  const artigosRef = useRef<HTMLDivElement>(null);
  const recursosRef = useRef<HTMLDivElement>(null);
  const quemSomosRef = useRef<HTMLDivElement>(null);
  const contatosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if(section === 'artigos' && artigosRef.current) {
        artigosRef.current.scrollIntoView({ behavior: 'smooth' });
      }
      if(section === 'recursos' && recursosRef.current) {
        recursosRef.current.scrollIntoView({ behavior: 'smooth' });
      }
      if(section === 'quem-somos' && quemSomosRef.current) {
        quemSomosRef.current.scrollIntoView({ behavior: 'smooth' });
      }
      if(section === 'contato' && contatosRef.current) {
        contatosRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);

      return () => clearTimeout(timer);
  }, [section]);

  return (
    <>

      <SEO
        title="Razão & Fé"
        description= {seoPresentationText.trim()}
        image='/seo-social-media-cover-img.webp'
        ogType="website"
        schemaType="WebPage"
        url="/"
        imageAlt="Evangelismo Digital - Compartilhando a mensagem da esperança pela internet"
      />
      
      <div ref={artigosRef} className='container mt-5'>
        <Artigos />
      </div>
      <div ref={recursosRef} className='container mt-5' id="recursosRef">
        <MaisRecursos />
      </div>
      <div ref={quemSomosRef} className={`mt-5 jumbotron jumbotron-fluid ${styles.quemSomos}`}>
        <QuemSomos href={'#contatosRef'}/>
      </div>
      <div ref={contatosRef} className='container form' id="contatosRef">
        <FormContatoHome/>
      </div>
      <div className='container mt-5'>
        <FindNearestChurch />
      </div>
    </>
  );
};

export default HomePage;