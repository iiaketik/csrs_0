# CATSALERS ARCHIVE

Telegram Mini App: дроп архивной одежды, рынок, аукцион, обмен и коллажи в чёрно-белом archive-стиле.

## Что внутри

- Вход только после подписки на **@CATSALERS**
- Бесплатный дроп раз в **2 часа** или платный за **1000 ₽**
- 5 редкостей: FOUND / ARCHIVE / VAULT / ATELIER / RELIC
- Инвентарь, продажа, аукцион, обмен
- Редактор коллажа: перетаскивание, размер, поворот, свой фон и музыка
- Лента коллажей как TikTok + сетка как Pinterest
- Каждый день в **22:00 (Москва)** бот пишет, сколько лайков собрали коллажи
- Админ загружает вещи **фото в бота**

Админ Telegram ID: `6562008872`

## Быстрый запуск на VPS

Нужен домен с HTTPS (Telegram Mini App без https не откроется).

```bash
sudo apt update
sudo apt install -y nodejs npm nginx
# либо docker
```

1. Залей папку проекта на сервер, например в `/opt/catsalers-archive`
2. В `.env` поставь свой домен:

```
PUBLIC_URL=https://archive.твой-домен.com
```

3. Установка и сборка:

```bash
cd /opt/catsalers-archive
npm install
npm run build
npm start
```

4. Nginx: скопируй `deploy/nginx.conf`, выпусти сертификат:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d archive.твой-домен.com
```

5. Сервис:

```bash
sudo cp deploy/catsalers.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now catsalers
```

Или Docker:

```bash
docker compose up -d --build
```

6. Напиши боту `/start`. Если `PUBLIC_URL` верный, появится кнопка **Открыть архив**.

## Админ

В бота:

- пришли **фото** вещи
- название
- редкость `1`–`5`
- цена в ₽

Команды:

- `/give 6562008872 5000` — начислить баланс
- `/stats`
- `/broadcast текст`

Платный дроп списывает внутренние 1000 ₽. Реальные платежи ЮKassa не подключены: баланс выдаёшь ты через `/give`.

## Локально

```bash
npm install
npm run dev
```

API: `http://127.0.0.1:3000`  
Фронт: `http://127.0.0.1:5173` (проксирует API)

Для теста Mini App нужен HTTPS-туннель (cloudflared / ngrok) на фронт или на `npm start` после `npm run build`, и этот URL в `PUBLIC_URL`.

`ALLOW_DEV=1` в `.env` пускает без Telegram (для вёрстки). Подписку всё равно проверяет, кроме админа.

## Данные

- SQLite: `data/archive.db`
- Картинки и музыка: `uploads/`
