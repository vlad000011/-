# Модель данных

| Таблица | Ключевые поля | Назначение |
|---|---|---|
| User | id, email, passwordHash, isBlocked | Учётная запись |
| Role | id, name | Роль USER/MODERATOR/ADMIN |
| UserRole | userId, roleId | Связь пользователя и роли |
| Category | id, name | Категории |
| Listing | id, title, description, ownerId, categoryId, status | Объявления |
| ListingImage | id, url, listingId | Фотографии |
| Favorite | userId, listingId | Избранное |
| Conversation | id, createdAt | Диалог |
| ConversationMember | conversationId, userId | Участники диалога |
| Message | id, body, conversationId, senderId | Сообщения |
| Report | id, reason, status, reporterId, listingId | Жалобы |
| AuditLog | id, action, userId, createdAt | Аудит |
| RefreshToken | id, tokenHash, expiresAt, userId | Refresh-сессии |

Внешние ключи обеспечивают ссылочную целостность. Для поиска и сортировки предусмотрены индексы по Listing.title, Listing.categoryId/status, Listing.createdAt и Message.conversationId/createdAt.
