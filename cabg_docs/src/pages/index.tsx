import React, { JSX } from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header style={{
      background: 'linear-gradient(135deg, #1a365d 0%, #2563eb 100%)',
      color: 'white',
      padding: '4rem 2rem',
      textAlign: 'center',
      borderRadius: '0 0 24px 24px',
      marginBottom: '2rem'
    }}>
      <h1 style={{fontSize: '2.5rem', marginBottom: '1rem'}}>
        Risk Predictor
      </h1>
      <p style={{fontSize: '1.2rem', opacity: 0.9, maxWidth: '600px', margin: '0 auto 2rem'}}>
        Документация системы прогнозирования риска осложнений после операции АКШ. <br />
      </p>
      <div style={{display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap'}}>
        <Link
          className="button button--secondary button--lg"
          to="/docs/about/purpose"
          style={{borderRadius: '8px'}}>
          О проекте
        </Link>
        <Link
          className="button button--secondary button--lg"
          to="/docs/user-guide/faq"
          style={{borderRadius: '8px'}}>
           Часто задаваемые вопросы
        </Link>
        <Link
          className="button button--secondary button--lg"
          to="/docs/dev-guide/architecture"
          style={{borderRadius: '8px'}}>
          Разработчикам
        </Link>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  return (
    <Layout title="Risk Predictor Docs">
      <HomepageHeader />
      <main style={{padding: '0 2rem', maxWidth: '800px', margin: '0 auto'}}>
        <p>
          Этот сайт содержит
          полное описание проекта, инструкцию пользователя и руководство разработчика.
        </p>
        <p>
          Выберите интересующий вас раздел в боковом меню или начните с кнопок выше.
        </p>
      </main>
    </Layout>
  );
}