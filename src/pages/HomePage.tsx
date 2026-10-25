import Artigos from '../components/Artigos';
import MaisRecursos from '../components/MaisRecursos';
import QuemSomos from '../components/QuemSomos';
import FormContatoHome from '../components/FormContatoHome';
import styles from './css/HomePage.module.css';
import { RefObject, useEffect, useRef } from 'react';
import SEO from '../components/SEO';
import { seoPresentationText } from '../templates/SEOPresentationText';
import FindNearestChurch from '../components/FindNearestChurch';

type HomePageProps = {
    section?: string;
};

/** Resolves once the window has loaded (images included), or at once if it already has. */
const whenPageLoaded = () => {
  if (document.readyState === 'complete') {
    return Promise.resolve();
  }
  // Stryker disable next-line ObjectLiteral,BooleanLiteral: "once" only drops the listener afterwards, nothing visible
  return new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
};

const HomePage = ({ section }: HomePageProps) => {
  const artigosRef = useRef<HTMLDivElement>(null);
  const recursosRef = useRef<HTMLDivElement>(null);
  const quemSomosRef = useRef<HTMLDivElement>(null);
  const contatosRef = useRef<HTMLDivElement>(null);
  const igrejaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refs: Record<string, RefObject<HTMLDivElement | null>> = {
      'artigos': artigosRef,
      'recursos': recursosRef,
      'quem-somos': quemSomosRef,
      'contato': contatosRef,
      'encontre-uma-igreja': igrejaRef,
    };
    const target = section ? refs[section] : undefined;
    if (!target) {
      return;
    }

    let cancelled = false;
    // Someone who starts scrolling while the page still loads has taken over: never yank them back.
    const userScrolled = () => {
      cancelled = true;
    };
    const userScrollEvents = ['wheel', 'touchmove', 'keydown'] as const;
    userScrollEvents.forEach((type) => window.addEventListener(type, userScrolled, { passive: true }));

    // A smooth scroll aims once, so wait until fonts and images above the section have their final size;
    // on a fresh load they otherwise shift the page mid-scroll and the heading ends up under the navbar.
    const timer = setTimeout(() => {
      Promise.all([whenPageLoaded(), document.fonts?.ready]).then(() => {
        if (!cancelled) {
          // Stryker disable next-line OptionalChaining: the section is rendered for as long as this effect is not cancelled
          target.current?.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }, 100);

    return () => {
      cancelled = true;
      userScrollEvents.forEach((type) => window.removeEventListener(type, userScrolled));
      // Stryker disable next-line CallExpression: an uncleared timer is harmless, "cancelled" already stops the scroll
      clearTimeout(timer);
    };
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
      
      <div ref={artigosRef} className={`container mt-5 ${styles.section}`}>
        <Artigos />
      </div>
      <div ref={recursosRef} className={`container mt-5 ${styles.section}`} id="recursosRef">
        <MaisRecursos />
      </div>
      <div ref={quemSomosRef} className={`mt-5 jumbotron jumbotron-fluid ${styles.quemSomos} ${styles.section}`}>
        <QuemSomos href={'#contatosRef'}/>
      </div>
      <div ref={contatosRef} className={`container form ${styles.section}`} id="contatosRef">
        <FormContatoHome/>
      </div>
      <div ref={igrejaRef} className={`container mt-5 ${styles.section}`} id="encontre-uma-igreja">
        <FindNearestChurch />
      </div>
    </>
  );
};

export default HomePage;