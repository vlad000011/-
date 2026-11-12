# Архитектура SwapSpace

Клиент-серверная архитектура: SPA (React) обращается к REST API (Express) по HTTP/JSON. Backend использует слои маршрутов, middleware, сервисов и репозитория Prisma. PostgreSQL — основное хранилище; файлы изображений сохраняются в Docker volume `uploads_data`.

```text
Браузер
  | React + TypeScript + React Router
  | HTTP/JSON + JWT
  v
Express REST API
  | middleware: CORS, Helmet, rate limit, auth, RBAC, validation
  | routes/controllers
  | services
  | Prisma ORM
  +--------------------> PostgreSQL
  +--------------------> uploads volume
```

## Слои

- Routes/controllers: HTTP, разбор параметров, статус-коды и ответы.
- Middleware: аутентификация, RBAC, ограничения запросов.
- Services: бизнес-операции, аудит и запросы каталога.
- Prisma: доступ к данным и миграции.
- Frontend: страницы, формы, API-клиент и хранение токенов.

## Основные меры безопасности

bcrypt-хэширование паролей, JWT access/refresh с разными секретами, серверная проверка ролей и владельца ресурса, Zod-валидация, Prisma-параметризация запросов, Helmet, CORS и rate limiting. Загрузка файлов ограничена MIME-типами и размером.

## ER-связи

User 1:N Listing; Category 1:N Listing; Listing 1:N ListingImage; User M:N Role через UserRole; User M:N Listing через Favorite; Conversation M:N User через ConversationMember; Conversation 1:N Message; User 1:N Message; User 1:N Report; Listing 1:N Report; User 1:N AuditLog; User 1:N RefreshToken.
