import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Risk Predictor',
  tagline: 'Прогнозирование рисков осложнений после АКШ',
  favicon: 'static/img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://cabg.insukuro.ru',
  baseUrl: '/docs/',

  organizationName: 'insukuro',
  projectName: 'risk-predictor',

  onBrokenLinks: 'warn',

  i18n: {
    defaultLocale: 'ru',
    locales: ['ru'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.js', 
          editUrl: 'https://github.com/insukuro/risk-predictor/tree/main/docs/',
        },
        blog: false, 
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Risk Predictor',
      logo: {
        alt: 'Logo',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Документация',
        },
        {
          href: 'https://github.com/insukuro/risk-predictor',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Документация',
          items: [
            {label: 'О проекте', to: 'about/purpose'},
            {label: 'FAQ', to: 'user-guide/faq'},
            {label: 'Разработчикам', to: 'dev-guide/architecture'},
          ],
        },
        {
          title: 'Ссылки',
          items: [
            {label: 'GitHub', href: 'https://github.com/insukuro/risk-predictor'},
            {label: 'Сайт', href: 'https://cabg.insukuro.ru'},
          ],
        },
      ],
      copyright: `Meow ${new Date().getFullYear()} Insukuro. Все права не защищены.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;