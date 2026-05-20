# NestJS Boilerplate

> A production-ready NestJS 11 service template built on Fastify, MongoDB, Redis caching, rate
> limiting, structured logging (Seq), observability (Prometheus), and Docker-first workflows.

## Feature Highlights

| Category                 | Features                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **HTTP**                 | Fastify adapter, Helmet security headers, multipart uploads (5 MB), global `ValidationPipe`                   |
| **API Docs**             | Swagger JSON at `/swagger`, Scalar interactive reference at `/docs`, JWT Bearer auth scheme                   |
| **Data**                 | MongoDB 7 via Mongoose, Redis 7 cache (`cache-manager-redis-yet`), soft-delete plugin, pagination helper      |
| **Resilience**           | Rate limiting (`ThrottlerGuard`), idempotency interceptor, graceful shutdown hooks                            |
| **Observability**        | Seq structured logging, Prometheus metrics endpoint, correlation ID per request                               |
| **Architecture**         | Zod-validated env config, event-driven (`@nestjs/event-emitter`), request context via CLS (AsyncLocalStorage) |
| **Developer Experience** | Database seeder CLI, Docker Compose dev stack, multi-stage Dockerfile, CI via GitHub Actions                  |

## Architecture Overview

### Bootstrap ([src/bootstrap.ts](src/bootstrap.ts))

Creates a `NestFastifyApplication` and registers:

- `@fastify/helmet` (CSP disabled for APIs)
- `@fastify/multipart` (5 MB file size limit)
- `ValidationPipe` with whitelist + transform + forbidNonWhitelisted
- Swagger document at `/swagger` + Scalar API reference at `/docs`
- `GlobalExceptionFilter` with `SeqLogger`
- `ConsoleSeqLogger` as the application logger
- `LoggingInterceptor` + `ResponseInterceptor` (both DI-resolved)
- Graceful shutdown hooks
- Listens on `PORT` from `ConfigService`

### App Module ([src/app.module.ts](src/app.module.ts))

- `ConfigModule` — global, validates `.env` with Zod schema
  ([src/shared/config/env.schema.ts](src/shared/config/env.schema.ts))
- `ContextModule` — global, provides `RequestContext` (CLS) + `CorrelationIdMiddleware`
- `EventEmitterModule` — in-process event bus
- `MongooseModule` — connects via `MONGODB_URI`
- `CacheModule` — Redis with `CACHE_TTL`, falls back to in-memory if Redis is unavailable
- `ThrottlerModule` — rate limiting via `THROTTLE_TTL` / `THROTTLE_LIMIT`
- `LoggerModule` — Seq structured logging
- `MonitoringModule` — Prometheus metrics interceptor
- Domain modules: `TurtleModule`, `HealthModule`

### Integrations ([src/integrations/](src/integrations/))

Third-party service wrappers, each self-contained:

| Directory     | Purpose                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------- |
| `logger/`     | `LoggerModule` (Seq via `@jasonsoft/nestjs-seq`) + `LoggingInterceptor`                  |
| `monitoring/` | `MonitoringModule` (Prometheus via `@willsoto/nestjs-prometheus`) + `MetricsInterceptor` |

### Shared ([src/shared/](src/shared/))

Core infrastructure with no external service coupling:

| Directory       | Purpose                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| `config/`       | Zod env schema, `EnvConfig` type, `ConfigModule` setup                     |
| `context/`      | `ContextModule`, `CorrelationIdMiddleware`, `RequestContext` service (CLS) |
| `pagination/`   | `PaginationQueryDto`, `paginate()` helper, `PaginatedResponse<T>` type     |
| `database/`     | Mongoose soft-delete plugin (`deletedAt`, `softDelete()`, `restore()`)     |
| `filters/`      | `GlobalExceptionFilter` with `ApiErrorCode` mapping                        |
| `health/`       | Liveness (`GET /health`) and readiness (`GET /ready`) endpoints            |
| `interceptors/` | Response envelope, idempotency interceptors                                |
| `http/`         | `ApiSuccessResponse`, `ApiErrorResponse`, idempotency utilities            |
| `cache/`        | Shared cache key helpers                                                   |

### Domain Modules ([src/modules/](src/modules/))

- **Turtle** — Full CRUD with pagination, soft delete, Redis caching, event emitting, and a database
  seeder.

## Repository Layout

```
├── Dockerfile                   # Multi-stage: base, deps, build, prod-deps, dev, runner
├── docker-compose.yml           # Dev stack: API + MongoDB + Redis + Seq
├── Makefile
├── src/
│   ├── main.ts                  # Entry point
│   ├── bootstrap.ts             # App bootstrap
│   ├── app.module.ts            # Root module
│   ├── cli/
│   │   └── seed.ts              # Database seeder CLI
│   ├── integrations/
│   │   ├── logger/              # Seq — LoggerModule + LoggingInterceptor
│   │   └── monitoring/          # Prometheus — MonitoringModule + MetricsInterceptor
│   ├── shared/
│   │   ├── config/              # Zod env validation + EnvConfig type
│   │   ├── context/             # CLS + correlation ID middleware
│   │   ├── database/            # Soft-delete plugin
│   │   ├── filters/             # Global exception filter
│   │   ├── health/              # Health + readiness controller
│   │   ├── http/                # Response types, request helpers
│   │   ├── interceptors/        # Response envelope, idempotency
│   │   ├── cache/               # Cache key builders
│   │   └── pagination/          # Pagination DTO + helper
│   └── modules/
│       └── turtle/              # CRUD module (service, repo, cache, events, seeder)
├── test/
│   ├── turtle.e2e-spec.ts
│   └── utils/                   # Test assertion helpers
└── .github/workflows/
    └── tests.yml
```

## Getting Started

### Prerequisites

- **Node.js** ≥ 20 (Docker images use Node 22-bookworm-slim)
- **npm** 10+
- **Docker Desktop** (or compatible engine) for the dev stack

### Install & Run

```bash
# install dependencies
npm install

# development (watch mode, no Docker)
npm run start:dev

# production build + run
npm run build && npm run start:prod

# seed the database
npx ts-node -r tsconfig-paths/register src/cli/seed.ts
```

### Docker Dev Stack

```bash
# copy example env and start the full stack
cp .env.example .env
make dev
```

The dev stack brings up:

| Service | Image          | Exposed Port(s)                                  |
| ------- | -------------- | ------------------------------------------------ |
| api     | local build    | `$PORT` → 3000                                   |
| mongodb | `mongo:7.0`    | `$MONGODB_PORT` → 27017                          |
| redis   | `redis:7.4`    | `$REDIS_PORT` → 6379                             |
| seq     | `datalust/seq` | `$SEQ_HTTP_PORT` → 80, `$SEQ_INGEST_PORT` → 5341 |

### Environment Configuration

Copy `.env.example` to `.env`. All variables are validated at startup via Zod — the app will fail
fast with clear error messages if required values are missing or malformed.

## npm Scripts

| Script                 | Description                 |
| ---------------------- | --------------------------- |
| `npm run start:dev`    | Start in watch mode         |
| `npm run start:debug`  | Start in debug + watch mode |
| `npm run build`        | Compile TypeScript          |
| `npm run start:prod`   | Run compiled output         |
| `npm run lint`         | ESLint with auto-fix        |
| `npm run format`       | Prettier format             |
| `npm run format:check` | Prettier check (no writes)  |
| `npm run test`         | Run unit tests              |
| `npm run test:e2e`     | Run e2e tests               |
| `npm run test:cov`     | Coverage report             |

## Make Targets

| Target           | Description                                     |
| ---------------- | ----------------------------------------------- |
| `make dev`       | Build and start the dev stack (attached)        |
| `make dev-down`  | Stop the dev stack and remove volumes + orphans |
| `make prod`      | Build production image and run with `.env` file |
| `make prod-down` | Stop the production container                   |

## Dockerfile Stages

The multi-stage `Dockerfile` defines:

| Stage       | Purpose                                               |
| ----------- | ----------------------------------------------------- |
| `base`      | Node 22 slim, sets WORKDIR                            |
| `deps`      | Installs all dependencies                             |
| `build`     | Compiles TypeScript (`npm run build`)                 |
| `prod-deps` | Installs production-only dependencies                 |
| `dev`       | Hot-reload development image (used by compose)        |
| `runner`    | Minimal production image (copies `dist/` + prod deps) |

## Environment Variables

| Variable                   | Default                                        | Purpose                                |
| -------------------------- | ---------------------------------------------- | -------------------------------------- |
| `NODE_ENV`                 | `development`                                  | Runtime environment                    |
| `APP_NAME`                 | `NestJS Boilerplate`                           | Application name (Swagger title)       |
| `APP_DESCRIPTION`          | `A NestJS boilerplate with batteries included` | Swagger description                    |
| `PORT`                     | `3000`                                         | Fastify listen port                    |
| `MONGO_INITDB_DATABASE`    | —                                              | MongoDB initial database name          |
| `MONGODB_URI`              | `mongodb://127.0.0.1:27017/turtles`            | MongoDB connection string              |
| `MONGODB_PORT`             | `27017`                                        | MongoDB host port (compose only)       |
| `REDIS_URL`                | `redis://127.0.0.1:6379`                       | Redis connection string                |
| `REDIS_PORT`               | `6379`                                         | Redis host port (compose only)         |
| `CACHE_TTL`                | `5`                                            | Cache TTL in seconds                   |
| `THROTTLE_TTL`             | `60`                                           | Rate-limit window (seconds)            |
| `THROTTLE_LIMIT`           | `100`                                          | Requests per IP per window             |
| `HEALTH_HEAP_THRESHOLD_MB` | `150`                                          | Max heap before health check fails     |
| `HEALTH_RSS_THRESHOLD_MB`  | `300`                                          | Max RSS before health check fails      |
| `SEQ_SERVER_URL`           | —                                              | Seq ingestion endpoint (optional)      |
| `SEQ_API_KEY`              | —                                              | Seq API key (optional)                 |
| `SEQ_SERVICE_NAME`         | `nestjs-boilerplate`                           | Service name sent to Seq               |
| `SEQ_HTTP_PORT`            | `8081`                                         | Seq web UI host port (compose only)    |
| `SEQ_INGEST_PORT`          | `5341`                                         | Seq ingestion host port (compose only) |
| `PROMETHEUS_METRICS_PATH`  | `metrics`                                      | Prometheus scrape path                 |

## API Endpoints

| Route          | Description                            |
| -------------- | -------------------------------------- |
| `GET /docs`    | Scalar interactive API reference       |
| `GET /swagger` | Raw OpenAPI JSON / Swagger UI          |
| `GET /health`  | Liveness check (heap, RSS, Redis)      |
| `GET /ready`   | Readiness check (MongoDB, Redis)       |
| `GET /metrics` | Prometheus metrics (path configurable) |

## Continuous Integration

`.github/workflows/tests.yml` runs on every push/PR to `main`:

1. Checkout → Docker Buildx setup → `make test`
2. Tests run against real MongoDB/Redis containers, matching production parity.

## License

MIT — see [LICENSE](LICENSE) for details.
