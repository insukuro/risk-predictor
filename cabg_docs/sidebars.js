// sidebars.js
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    // Раздел: О проекте
    {
      type: 'category',
      label: 'О проекте',
      collapsible: false,
      items: [
        'about/purpose',
        'about/team',
        'about/contacts',
      ],
    },
    // Раздел: User Guide (только FAQ и глоссарий)
    {
      type: 'category',
      label: 'User Guide',
      items: [
        'user-guide/faq',
        'user-guide/glossary',
      ],
    },
    // Раздел: Developer Guide
    {
      type: 'category',
      label: 'Developer Guide',
      items: [
        'dev-guide/architecture',
        'dev-guide/system-requirements',
        'dev-guide/tech-stack',
        {
          type: 'category',
          label: 'Развертка (Deployment)',
          items: [
            'dev-guide/deployment/local-dev',
            'dev-guide/deployment/docker',
          ],
        },
        'dev-guide/services',
        'dev-guide/ci-cd',
        {
          type: 'category',
          label: 'Гайды по расширению',
          items: [
            'dev-guide/how-to/add-scale',
            'dev-guide/how-to/add-model',
          ],
        },
        'dev-guide/api-reference',
        'dev-guide/logging',
      ],
    },
  ],
};

module.exports = sidebars;