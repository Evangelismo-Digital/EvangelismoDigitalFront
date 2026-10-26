import styles from './css/ArticlePage.module.css'
import { useParams } from 'react-router-dom';
import FormContatoArticle from "../components/FormContatoArticle";
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

// Eager: the article must be there on the very first render. The prerendered HTML holds the full text,
// so an article that only appeared after an async import would not match it when the page hydrates
// (React #418) and React would throw the page away and render it again. All articles together are ~11 KB.
// Stryker disable next-line StringLiteral,ObjectLiteral,BooleanLiteral: import.meta.glob takes only literals, which Vite expands at build time
const articles = import.meta.glob<ArticleModule>('../articleContent/articlesData/*.mdx', { eager: true });

const ArticlePage = () => {
  const { artigoId } = useParams<{ artigoId: string }>();

  const article = articles[`../articleContent/articlesData/${artigoId}.mdx`];
  const ArticleComponent = article?.default;
  const frontmatter = article?.frontmatter;

  if(!ArticleComponent || !frontmatter) {
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
          <article className={styles.articleSection} data-analytics-article>
            
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