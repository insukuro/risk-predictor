
## Действия перед запуском

### Настройте `git`

1) Установите `vscode` / `cursor`
2) Установите `git`

https://git-scm.com/

3) Зайти в `GitHub` в `vscode` / `cursor`

4) Привязать почту к коммитам (обязательно)

```bash
git config --global user.email ЭЛЕКТРОННАЯ-ПОЧТА
```

5) Установить отображаеммое при коммите имя (обязательно)

```bash
git config --global user.name ФАМИЛИЯ-ИМЯ
```


6) Скопируйте репозиторий с `GitHub`'а

```bash
git clone https://github.com/Kilisaki/risk-predictor

```

### Настройте `Docker`

1) Установите `docker`

2) Выдайте `docker`'у права супер-пользователя, чтобы не вводить постоянно `sudo` (если на `Linux`)

```bash
sudo usermod -aG docker $USER
```

3) Создайте общие сети

```bash
docker network create docker_web-network

```

Docs: cabg.insukuro.ru/docs


```
risk-predictor
├─ .$idef0.xml.bkp
├─ .dockerignore
├─ README.md
├─ alembic
│  ├─ README
│  ├─ env.py
│  ├─ script.py.mako
│  └─ versions
├─ alembic.ini
├─ backend
│  ├─ __init__.py
│  ├─ api
│  │  ├─ __init__.py
│  │  ├─ dependencies
│  │  │  ├─ __init__.py
│  │  │  └─ auth.py
│  │  └─ routes
│  │     ├─ __init__.py
│  │     ├─ health.py
│  │     ├─ operations.py
│  │     ├─ patients.py
│  │     └─ predictions.py
│  ├─ clients
│  │  └─ ml_client.py
│  ├─ core
│  │  ├─ __init__.py
│  │  ├─ config.py
│  │  └─ metadata.py
│  ├─ db
│  │  ├─ __init__.py
│  │  ├─ models.py
│  │  └─ session.py
│  ├─ main.py
│  ├─ models
│  │  ├─ __init__.py
│  │  └─ schemas.py
│  └─ services
│     ├─ __init__.py
│     ├─ cache_service.py
│     ├─ operation_service.py
│     ├─ patient_service.py
│     └─ prediction_service.py
├─ cabg_docs
│  ├─ .docusaurus
│  │  ├─ DONT-EDIT-THIS-FOLDER
│  │  ├─ client-modules.js
│  │  ├─ codeTranslations.json
│  │  ├─ docusaurus-plugin-content-docs
│  │  │  └─ default
│  │  │     ├─ __mdx-loader-dependency.json
│  │  │     ├─ __plugin.json
│  │  │     ├─ p
│  │  │     │  ├─ docs-175.json
│  │  │     │  └─ docs-docs-fbb.json
│  │  │     ├─ site-docs-about-contacts-md-b1e.json
│  │  │     ├─ site-docs-about-purpose-md-a9a.json
│  │  │     ├─ site-docs-about-team-md-f24.json
│  │  │     ├─ site-docs-dev-guide-api-reference-md-9b8.json
│  │  │     ├─ site-docs-dev-guide-architecture-md-417.json
│  │  │     ├─ site-docs-dev-guide-ci-cd-md-6a5.json
│  │  │     ├─ site-docs-dev-guide-deployment-docker-md-d40.json
│  │  │     ├─ site-docs-dev-guide-deployment-local-dev-md-fa2.json
│  │  │     ├─ site-docs-dev-guide-how-to-add-model-md-1e9.json
│  │  │     ├─ site-docs-dev-guide-how-to-add-scale-md-40c.json
│  │  │     ├─ site-docs-dev-guide-logging-md-610.json
│  │  │     ├─ site-docs-dev-guide-services-md-e69.json
│  │  │     ├─ site-docs-dev-guide-system-requirements-md-509.json
│  │  │     ├─ site-docs-dev-guide-tech-stack-md-e6d.json
│  │  │     ├─ site-docs-intro-mdx-f84.json
│  │  │     ├─ site-docs-user-guide-faq-md-9fa.json
│  │  │     └─ site-docs-user-guide-glossary-md-89a.json
│  │  ├─ docusaurus-plugin-content-pages
│  │  │  └─ default
│  │  │     ├─ __plugin.json
│  │  │     └─ site-src-pages-markdown-page-mdx-4c6.json
│  │  ├─ docusaurus-plugin-css-cascade-layers
│  │  │  └─ default
│  │  │     ├─ __plugin.json
│  │  │     └─ layers.css
│  │  ├─ docusaurus-plugin-debug
│  │  │  └─ default
│  │  │     ├─ __plugin.json
│  │  │     └─ p
│  │  │        ├─ docs-docusaurus-debug-content-a52.json
│  │  │        └─ docusaurus-debug-content-0d5.json
│  │  ├─ docusaurus.config.mjs
│  │  ├─ globalData.json
│  │  ├─ i18n.json
│  │  ├─ registry.js
│  │  ├─ routes.js
│  │  ├─ routesChunkNames.json
│  │  ├─ site-metadata.json
│  │  └─ site-storage.json
│  ├─ README.md
│  ├─ docs
│  │  ├─ about
│  │  │  ├─ contacts.md
│  │  │  ├─ purpose.md
│  │  │  └─ team.md
│  │  ├─ dev-guide
│  │  │  ├─ api-reference.md
│  │  │  ├─ architecture.md
│  │  │  ├─ ci-cd.md
│  │  │  ├─ deployment
│  │  │  │  ├─ docker.md
│  │  │  │  └─ local-dev.md
│  │  │  ├─ how-to
│  │  │  │  ├─ add-model.md
│  │  │  │  └─ add-scale.md
│  │  │  ├─ logging.md
│  │  │  ├─ services.md
│  │  │  ├─ system-requirements.md
│  │  │  └─ tech-stack.md
│  │  └─ user-guide
│  │     ├─ faq.md
│  │     └─ glossary.md
│  ├─ docusaurus.config.ts
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ sidebars.js
│  ├─ src
│  │  ├─ components
│  │  │  └─ HomepageFeatures
│  │  │     ├─ index.tsx
│  │  │     └─ styles.module.css
│  │  ├─ css
│  │  │  └─ custom.css
│  │  └─ pages
│  │     ├─ index.module.css
│  │     └─ index.tsx
│  ├─ static
│  │  ├─ .nojekyll
│  │  └─ img
│  │     ├─ diagrams
│  │     │  ├─ dataflow.png
│  │     │  ├─ idef0-A-0.png
│  │     │  ├─ idef0-A0.png
│  │     │  └─ idef0-A3.png
│  │     ├─ favicon.ico
│  │     ├─ logo.png
│  │     └─ logo.svg
│  └─ tsconfig.json
├─ calc_service
│  ├─ __init__.py
│  ├─ app
│  │  ├─ __init__.py
│  │  ├─ api_endpoints.py
│  │  ├─ engine.py
│  │  ├─ schemas.py
│  │  └─ ui_endpoints.py
│  ├─ coefficients.json
│  ├─ config.py
│  └─ main.py
├─ data
│  └─ postgres
├─ docker-compose.yml
├─ frontend
│  ├─ index.html
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ src
│  │  ├─ App.tsx
│  │  ├─ api
│  │  │  ├─ analytics.ts
│  │  │  ├─ calculators.ts
│  │  │  ├─ client.ts
│  │  │  ├─ index.ts
│  │  │  ├─ mockData.ts
│  │  │  ├─ patients.ts
│  │  │  └─ predictions.ts
│  │  ├─ components
│  │  │  ├─ ClipboardButton.tsx
│  │  │  ├─ DropZone.tsx
│  │  │  ├─ DynamicForm.tsx
│  │  │  ├─ ModeSelector.tsx
│  │  │  ├─ PatientSelector.tsx
│  │  │  ├─ ResultDisplay.tsx
│  │  │  └─ ui
│  │  │     ├─ Badge.tsx
│  │  │     ├─ Button.tsx
│  │  │     ├─ Card.tsx
│  │  │     ├─ Drawer.tsx
│  │  │     ├─ Input.tsx
│  │  │     ├─ Modal.tsx
│  │  │     ├─ Select.tsx
│  │  │     ├─ Tabs.tsx
│  │  │     ├─ Toast.tsx
│  │  │     ├─ Toggle.tsx
│  │  │     └─ index.ts
│  │  ├─ hooks
│  │  │  ├─ index.ts
│  │  │  └─ useDebounce.ts
│  │  ├─ index.css
│  │  ├─ main.tsx
│  │  ├─ modules
│  │  │  ├─ AnalyticsModule.tsx
│  │  │  ├─ CalculatorModule.tsx
│  │  │  ├─ HistoryModule.tsx
│  │  │  ├─ PredictionModule.tsx
│  │  │  └─ index.ts
│  │  ├─ types
│  │  │  └─ index.ts
│  │  └─ utils
│  │     ├─ clipboardParser.ts
│  │     ├─ cn.ts
│  │     ├─ excelParser.ts
│  │     └─ index.ts
│  ├─ tsconfig.json
│  └─ vite.config.ts
├─ idef0.xml
├─ infrastructure
│  ├─ docker
│  │  ├─ backend.Dockerfile
│  │  ├─ calc_service.Dockerfile
│  │  ├─ database.Dockerfile
│  │  ├─ docs.Dockerfile
│  │  ├─ entrypoint.sh
│  │  ├─ frontend.Dockerfile
│  │  ├─ init-db.sql
│  │  └─ ml_service.Dockerfile
│  └─ nginx
│     ├─ default.conf
│     └─ nginx.conf
├─ ml_service
│  ├─ __init__.py
│  ├─ api
│  │  └─ routes.py
│  ├─ config.py
│  ├─ constants.py
│  ├─ features
│  │  ├─ __init__.py
│  │  ├─ importance.py
│  │  ├─ preparation.py
│  │  └─ tabnet_preparation.py
│  ├─ main.py
│  ├─ model_versions
│  │  ├─ model_v1.pkl
│  │  ├─ model_v2.pkl
│  │  └─ model_v3.pkl
│  ├─ models
│  │  ├─ __init__.py
│  │  ├─ loader.py
│  │  ├─ predictor.py
│  │  ├─ registry.py
│  │  └─ tabnet_predictor.py
│  ├─ schemas
│  │  ├─ __init__.py
│  │  └─ requests.py
│  └─ utils
│     ├─ __init__.py
│     └─ helpers.py
├─ requirements
│  ├─ backend.txt
│  ├─ base.txt
│  ├─ calc.txt
│  └─ ml.txt
└─ test.py

```