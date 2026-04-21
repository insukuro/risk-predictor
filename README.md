
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



```
risk-predictor
├─ .$idef0.xml.bkp
├─ .dockerignore
├─ DOCKER_GUIDE.md
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
│  │     ├─ operations.py
│  │     ├─ patients.py
│  │     └─ predictions.py
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
├─ docker-compose.yml
├─ idef0-A-0 Контекстная диаграмма.drawio.png
├─ idef0-A0 Декомпозиция.drawio.png
├─ idef0-A3 Декомпозиция.drawio.png
├─ idef0.xml
├─ infrastructure
│  ├─ docker
│  │  ├─ backend.Dockerfile
│  │  ├─ database.Dockerfile
│  │  ├─ frontend.Dockerfile
│  │  ├─ init-db.sql
│  │  └─ ml_service.Dockerfile
│  ├─ nginx
│  │  ├─ default.conf
│  │  └─ nginx.conf
│  └─ terraform
├─ ml
│  ├─ __init__.py
│  ├─ ml_service.py
│  ├─ models
│  └─ test.py
├─ requirements.txt
└─ test_backend.py

```