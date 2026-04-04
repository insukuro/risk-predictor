
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
docker network create ml-back
docker network create front-back

```


# idef0:
## A-0
![A-0](<idef0-A-0 Контекстная диаграмма.drawio.png>)

## A0
![A0](<idef0-A0 Декомпозиция.drawio.png>)

## A3
![A3](<idef0-A3 Декомпозиция.drawio.png>)


# Project tree
```

```
```
risk-predictor
├─ .$idef0.xml.bkp
├─ .dockerignore
├─ DELIVERY_SUMMARY.md
├─ DOCKER_GUIDE.md
├─ IMPLEMENTATION_CHECKLIST.md
├─ INDEX.md
├─ LICENSE
├─ MVP_GUIDE.md
├─ PROJECT_SUMMARY.md
├─ QUICK_START.md
├─ README.md
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
│  │     └─ predict.py
│  ├─ db
│  │  ├─ __init__.py
│  │  ├─ models.py
│  │  └─ session.py
│  ├─ main.py
│  ├─ ml
│  │  ├─ __init__.py
│  │  ├─ predict.py
│  │  └─ train.py
│  ├─ models
│  │  ├─ __init__.py
│  │  └─ schemas.py
│  └─ services
│     ├─ __init__.py
│     └─ risk_predictor.py
├─ docker-compose.yml
├─ docker-helper.sh
├─ frontend
│  ├─ README.md
│  ├─ eslint.config.js
│  ├─ index.html
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ public
│  │  └─ vite.svg
│  ├─ src
│  │  ├─ App.css
│  │  ├─ App.tsx
│  │  ├─ api
│  │  │  └─ client.ts
│  │  ├─ api.ts
│  │  ├─ assets
│  │  │  └─ react.svg
│  │  ├─ components
│  │  │  ├─ PatientInfo.css
│  │  │  ├─ PatientInfo.tsx
│  │  │  ├─ PredictForm.css
│  │  │  ├─ PredictForm.tsx
│  │  │  ├─ PredictionHistory.css
│  │  │  └─ PredictionHistory.tsx
│  │  ├─ index.css
│  │  └─ main.tsx
│  ├─ tsconfig.app.json
│  ├─ tsconfig.json
│  ├─ tsconfig.node.json
│  └─ vite.config.ts
├─ idef0-A-0 Контекстная диаграмма.drawio.png
├─ idef0-A0 Декомпозиция.drawio.png
├─ idef0-A3 Декомпозиция.drawio.png
├─ idef0.xml
├─ infrastructure
│  ├─ docker
│  │  ├─ backend.Dockerfile
│  │  ├─ database.Dockerfile
│  │  ├─ frontend.Dockerfile
│  │  └─ init-db.sql
│  ├─ nginx
│  │  └─ nginx.conf
│  └─ terraform
├─ requirements.txt
├─ setup.sh
├─ start_backend.sh
├─ start_frontend.sh
├─ test_backend.py
└─ Не подтверждено 378621.~

```