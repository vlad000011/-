# SwapSpace — сервис обмена вещами

Учебный fullstack-проект: React + TypeScript, Express + TypeScript, PostgreSQL, Prisma, JWT, Swagger, Docker Compose.

## Быстрый запуск (macOS / Windows 11)

1. Установить и запустить Docker Desktop.
2. Скопировать `.env.example` в `.env`.
3. В терминале из корня проекта выполнить:

```bash
docker compose up --build
```

При первом запуске контейнер backend применит миграции, заполнит тестовые данные и запустит API.

- Приложение: http://localhost:5173
- API: http://localhost:3000/api
- Swagger: http://localhost:3000/api/docs
- Проверка API: http://localhost:3000/api/health

Остановка: `Ctrl+C`, затем `docker compose down`. Данные БД сохраняются в Docker volume.
Полный сброс данных: `docker compose down -v` (удалит БД и загруженные файлы).

## Тестовые учётные записи

| Роль | Email | Пароль |
|---|---|---|
| Пользователь | user@swapspace.local | User123! |
| Модератор | moderator@swapspace.local | Moderator123! |
| Администратор | admin@swapspace.local | Admin123! |

Гостю доступен каталог без входа. Seed создаёт аккаунты и демонстрационные объявления.

## Возможности

- Регистрация, вход, обновление access-токена, выход.
- Роли USER, MODERATOR, ADMIN; серверная проверка прав.
- Объявления: создание, редактирование, удаление, просмотр, фильтры, поиск, сортировка и пагинация.
- Изображения: загрузка JPEG/PNG/WebP до 5 МБ.
- Избранное, диалоги и сообщения, жалобы.
- Панель модерации, блокировка пользователей, управление ролями.
- Журнал аудита и сводная статистика.
- Swagger/OpenAPI, миграции и seed.
- Unit и API integration тесты, frontend component tests.
- GitHub Actions CI.

## Локальная разработка без Docker (необязательно)

Нужны Node.js 20+ и PostgreSQL 16+. Создайте `.env` в корне и задайте `DATABASE_URL` с адресом локальной БД. Затем:

```bash
npm install
npm run dev
```

Для запуска backend отдельно: `npm run dev -w backend`; frontend отдельно: `npm run dev -w frontend`.

## Структура

- `frontend/` — SPA на React + TypeScript + Vite.
- `backend/` — REST API, слои routes/controllers/services/repositories.
- `backend/prisma/` — схема, миграция и seed.
- `docs/` — user stories, архитектура, ER-описание.
- `.github/workflows/ci.yml` — автоматические проверки.

## Безопасность и учебные ограничения

Пароли хешируются bcrypt. Access/refresh токены подписываются разными секретами. В production обязательно заменить секреты, ограничить CORS реальным доменом, использовать HTTPS, настроить резервное копирование и хранение файлов. Восстановление пароля в учебной версии возвращает демонстрационный токен в ответе API; реальная почтовая отправка не настроена.

## Демо-сценарий защиты

1. Открыть каталог гостем, выполнить поиск и фильтрацию.
2. Войти как `user@swapspace.local`, создать объявление с фото.
3. Добавить объявление в избранное.
4. Открыть объявление другого пользователя и отправить сообщение.
5. Отправить жалобу.
6. Войти модератором и скрыть объявление / обработать жалобу.
7. Войти администратором и открыть пользователей, статистику и журнал аудита.

## Команды

```bash
docker compose logs -f backend
docker compose down
docker compose down -v
```
