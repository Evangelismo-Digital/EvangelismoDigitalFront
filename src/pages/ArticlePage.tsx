import styles from './css/ArticlePage.module.css'
import { useParams } from 'react-router-dom';
import FormContatoArticle from "../components/FormContatoArticle";
import { useEffect, useState } from 'react';
import SEO from '../components/SEO';
import FindNearestChurch from '../components/FindNearestChurch';
import { MDXProvider } from '@mdx-js/react';
import CallToAction from '../components/CallToAction';
import { getCallToActionContent } from '../config/callToActionContent';
import type { MDXContent } from 'mdx/types';

interface ArticleFrontmatter {
  title: string
  description: string
  datePublished?: string
  dateModified?: string
  author?: string
  imgMainCoverPage?: string
  imgArticle?: string
  imgAlt?: string
}

interface ArticleModule {
  default: MDXContent
  frontmatter: ArticleFrontmatter
}

const mdxComponents = {
  // You can add more custom components here if needed
}

const ArticlePage = () => {
  const { artigoId } = useParams<{ artigoId: string }>();

  const [ArticleComponent, setArticleComponent] = useState<MDXContent | null>(null)
  const [frontmatter, setFrontmatter] = useState<ArticleFrontmatter | null>(null)

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if(!artigoId) {
      setError(true);
      setLoading(false);
      return;
    }

    const loadArticle = async () => {
    try {
      setLoading(true);
      // A previous slug may have failed: start each article clean, or a good link would still show "not found".
      setError(false);
      // Stryker disable next-line StringLiteral: import.meta.glob takes only a literal, which Vite expands at build time
      const articles = import.meta.glob('../articleContent/articlesData/*.mdx');
      const articleLoader = articles[`../articleContent/articlesData/${artigoId}.mdx`];

      if (!articleLoader) {
        throw new Error("Article not found");
      }

      const module = await articleLoader() as ArticleModule

      setArticleComponent(() => module.default)
      setFrontmatter(module.frontmatter)
      setLoading(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadArticle();
  }, [artigoId]);

  if(loading) {
    return (
      <>
        <div className="container mt-5 text-center">
          <div className="spinner-border" role="status">
          </div>
        </div>
      </>
    );
  }

  if(error || !ArticleComponent || !frontmatter) {
    return (
      <div className="container mt-5">
        <h1>Página não encontrada</h1>
        <p>O artigo solicitado não existe.</p>
      </div>
    );
  }

  const callToActionData = getCallToActionContent(artigoId)

  return (
    <>
      <SEO
        title={frontmatter.title}
        description={frontmatter.description}
        image={frontmatter.imgMainCoverPage || frontmatter.imgArticle}
        url={`/artigo/${artigoId}`}
        ogType="article"
        schemaType="Article"
        datePublished={frontmatter.datePublished ? new Date(frontmatter.datePublished) : undefined}
        dateModified={frontmatter.dateModified ? new Date(frontmatter.dateModified) : undefined}
        author={frontmatter.author}
        imageAlt={frontmatter.imgAlt || frontmatter.title}
      />

      <MDXProvider components={mdxComponents}>
        <div className='container mt-5'>
          <article className={styles.articleSection}>
            
            <div className={styles['article-header']}>
              
                <h1 className="mb-4">
                  {frontmatter.title}
                </h1>

                <img 
                  src={frontmatter.imgArticle}
                  alt={frontmatter.imgAlt || frontmatter.title}
                  className="img-fluid mb-5 rounded-4 w-100"
                />

            </div>

            <ArticleComponent />
          </article>
        </div>
      </MDXProvider>

      <div className='container mt-5'>
        <CallToAction title={callToActionData.title}>
          {callToActionData.content}
        </CallToAction>
      </div>

      <FormContatoArticle/>

      <FindNearestChurch />
    </>
  );
};

export default ArticlePage;