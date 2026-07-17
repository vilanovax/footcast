# استقرار — Football Newsroom

## محیط توسعه محلی

پیش‌نیاز: Docker, Docker Compose, Node.js 22+, pnpm 9+

```bash
cp .env.example .env
pnpm install
pnpm docker:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

سرویس‌ها:

| Service | Port | توضیح |
|---------|------|--------|
| web | 3000 | Next.js |
| api | 3001 | NestJS |
| postgres | 55432 | DB (mapped from container 5432) |
| redis | 56379 | Queue/cache (mapped from container 6379) |

## Docker Compose (توسعه)

سرویس‌ها: `postgres`, `redis`, `api`, `web`, `worker`, `crawler`  
در فاز صفر worker/crawler می‌توانند به‌صورت process محلی با همان کد و stub queue بالا بیایند.

## متغیرهای محیطی کلیدی

```bash
NODE_ENV=development
DATABASE_URL=postgres://footcast:footcast@localhost:55432/footcast
REDIS_URL=redis://localhost:56379
JWT_ACCESS_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
SECRETS_ENCRYPTION_KEY=32-byte-hex-or-base64
WEB_ORIGIN=http://localhost:3000
API_PORT=3001
```

هیچ API Key واقعی در git ذخیره نشود.

## Production (هدف آینده)

- Nginx reverse proxy + TLS
- Worker و Crawler به‌صورت replica جدا
- S3-compatible برای HTML خام و audio
- Backup روزانه Postgres
- Retention برای raw HTML و logs
- Health checks در orchestrator

## Migration

Sequelize CLI از `packages/database`:

```bash
pnpm --filter @footcast/database migrate
pnpm --filter @footcast/database seed
```

## Rollback

Migration down برای تغییرات برگشت‌پذیر؛ برای data migration خطرناک از ADR جداگانه استفاده شود.
