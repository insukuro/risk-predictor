
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


# idef0:
## A-0
![A-0](<idef0-A-0 Контекстная диаграмма.drawio.png>)

## A0
![A0](<idef0-A0 Декомпозиция.drawio.png>)

## A3
![A3](<idef0-A3 Декомпозиция.drawio.png>)



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
│     ├─ operation_service.py
│     ├─ patient_service.py
│     └─ prediction_service.py
├─ calc_service
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
│  │  ├─ components
│  │  │  ├─ Header.tsx
│  │  │  ├─ HistoryView.tsx
│  │  │  ├─ ModelInfoCard.tsx
│  │  │  ├─ PatientDialog.tsx
│  │  │  ├─ PredictiveForm.tsx
│  │  │  ├─ ResultDisplay.tsx
│  │  │  └─ ui
│  │  │     ├─ Badge.tsx
│  │  │     ├─ Button.tsx
│  │  │     ├─ Card.tsx
│  │  │     ├─ Dialog.tsx
│  │  │     ├─ Input.tsx
│  │  │     ├─ Select.tsx
│  │  │     ├─ Skeleton.tsx
│  │  │     ├─ Spinner.tsx
│  │  │     └─ Switch.tsx
│  │  ├─ hooks
│  │  │  └─ useTaskPoller.ts
│  │  ├─ index.css
│  │  ├─ lib
│  │  │  ├─ api.ts
│  │  │  └─ utils.ts
│  │  ├─ main.tsx
│  │  ├─ types
│  │  │  └─ index.ts
│  │  └─ vite-env.d.ts
│  ├─ tsconfig.json
│  └─ vite.config.ts
├─ idef0-A-0 Контекстная диаграмма.drawio.png
├─ idef0-A0 Декомпозиция.drawio.png
├─ idef0-A3 Декомпозиция.drawio.png
├─ idef0.xml
├─ infrastructure
│  ├─ docker
│  │  ├─ backend.Dockerfile
│  │  ├─ calc_service.Dockerfile
│  │  ├─ database.Dockerfile
│  │  ├─ entrypoint.sh
│  │  ├─ frontend.Dockerfile
│  │  ├─ init-db.sql
│  │  └─ ml_service.Dockerfile
│  └─ nginx
│     ├─ default.conf
│     └─ nginx.conf
├─ ml_service
│  ├─ __init__.py
│  ├─ config.py
│  ├─ features
│  │  ├─ __init__.py
│  │  ├─ engineering.py
│  │  └─ importance.py
│  ├─ main.py
│  ├─ model_versions
│  │  ├─ model_v1.pkl
│  │  └─ model_v2.pkl
│  ├─ models
│  │  ├─ __init__.py
│  │  ├─ loader.py
│  │  ├─ predictor.py
│  │  └─ registry.py
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
└─ scripts
   └─ auto-version-models.sh

```