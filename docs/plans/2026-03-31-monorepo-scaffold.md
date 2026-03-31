# Monorepo Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the NextQuest monorepo so that `pnpm install && pnpm docker:up && pnpm dev` starts the API, web, and mobile apps with shared packages, linting, and Docker services.

**Architecture:** pnpm workspaces + Turborepo monorepo with 3 apps (Fastify API, Nuxt web, Expo mobile) and 3 shared packages (shared types/validators, db schema, config). Docker Compose for PostgreSQL 16 + Redis 7. All TypeScript strict.

**Tech Stack:** Node.js 22, TypeScript 5, pnpm, Turborepo, Fastify 5, Nuxt 3, Expo/React Native, Drizzle ORM, PostgreSQL 16, Redis 7, Zod, Vitest, ESLint 9, Prettier, Tailwind CSS.

---

## File Structure

```
nextquest/
├── package.json                      # Root workspace scripts
├── pnpm-workspace.yaml               # Workspace definition
├── turbo.json                        # Turborepo pipeline config
├── .nvmrc                            # Node version pinned to 22
├── .env.example                      # Template env vars
├── .gitignore                        # (exists, update)
├── .npmrc                            # pnpm config
│
├── docker/
│   ├── docker-compose.yml            # PostgreSQL 16 + Redis 7
│   └── postgres/
│       └── init.sql                  # Extensions (uuid-ossp, pgcrypto)
│
├── packages/
│   ├── config/
│   │   ├── package.json
│   │   ├── eslint.config.mjs         # Shared ESLint 9 flat config
│   │   ├── tsconfig.base.json        # Shared TS config
│   │   └── prettier.config.mjs       # Shared Prettier config
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts              # Barrel export
│   │       ├── types/
│   │       │   └── user.ts           # Example shared type
│   │       └── validators/
│   │           └── user.ts           # Example Zod schema
│   └── db/
│       ├── package.json
│       ├── tsconfig.json
│       ├── drizzle.config.ts         # Drizzle Kit config
│       └── src/
│           ├── index.ts              # Barrel export (client + schema)
│           ├── client.ts             # PostgreSQL connection
│           ├── schema/
│           │   └── users.ts          # First table (users)
│           └── seed.ts               # Dev seed script
│
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── server.ts             # Fastify entry point
│   │       ├── plugins/
│   │       │   ├── cors.ts           # CORS plugin
│   │       │   └── swagger.ts        # Swagger/OpenAPI plugin
│   │       └── modules/
│   │           └── health/
│   │               ├── health.routes.ts
│   │               └── health.controller.ts
│   ├── web/
│   │   └── (nuxt init output)        # Created by nuxi init
│   └── mobile/
│       └── (expo init output)         # Created by create-expo-app
│
├── .github/
│   └── workflows/
│       └── ci.yml                     # Lint + typecheck + test + build
│
└── docs/                              # (exists, unchanged)
```

---

### Task 1: Install pnpm and root workspace

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `.nvmrc`
- Replace: `package.json`

- [ ] **Step 1: Install pnpm globally**

```bash
npm install -g pnpm
```

Expected: `pnpm --version` shows `10.x`

- [ ] **Step 2: Create .nvmrc**

```bash
echo "22" > .nvmrc
```

- [ ] **Step 3: Create .npmrc**

Write to `.npmrc`:
```ini
engine-strict=true
auto-install-peers=true
shamefully-hoist=false
```

- [ ] **Step 4: Create pnpm-workspace.yaml**

Write to `pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 5: Create root package.json**

Write to `package.json`:
```json
{
  "name": "nextquest",
  "private": true,
  "packageManager": "pnpm@10.8.1",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "typecheck": "turbo typecheck",
    "docker:up": "docker compose -f docker/docker-compose.yml up -d",
    "docker:down": "docker compose -f docker/docker-compose.yml down",
    "db:generate": "pnpm --filter @nextquest/db db:generate",
    "db:migrate": "pnpm --filter @nextquest/db db:migrate",
    "db:seed": "pnpm --filter @nextquest/db db:seed",
    "db:studio": "pnpm --filter @nextquest/db db:studio"
  },
  "devDependencies": {
    "turbo": "^2.5.4"
  }
}
```

- [ ] **Step 6: Run pnpm install**

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` created, `node_modules/` has turbo.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml .nvmrc .npmrc
git commit -m "feat: init monorepo pnpm + Turborepo"
```

---

### Task 2: Shared config package (ESLint, TypeScript, Prettier)

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/eslint.config.mjs`
- Create: `packages/config/tsconfig.base.json`
- Create: `packages/config/prettier.config.mjs`

- [ ] **Step 1: Create packages/config/package.json**

```json
{
  "name": "@nextquest/config",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    "./eslint": "./eslint.config.mjs",
    "./typescript": "./tsconfig.base.json",
    "./prettier": "./prettier.config.mjs"
  },
  "devDependencies": {
    "eslint": "^10.1.0",
    "eslint-config-prettier": "^10.1.5",
    "typescript-eslint": "^8.33.1",
    "prettier": "^3.8.1",
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Create packages/config/tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist"
  },
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create packages/config/eslint.config.mjs**

```javascript
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  tseslint.configs.recommended,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.nuxt/**", "**/.expo/**"],
  }
);
```

- [ ] **Step 4: Create packages/config/prettier.config.mjs**

```javascript
export default {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "all",
  printWidth: 100,
};
```

- [ ] **Step 5: Install and commit**

```bash
pnpm install
git add packages/config/
git commit -m "feat: ajout package config (ESLint, TypeScript, Prettier)"
```

---

### Task 3: Shared types/validators package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types/user.ts`
- Create: `packages/shared/src/validators/user.ts`

- [ ] **Step 1: Create packages/shared/package.json**

```json
{
  "name": "@nextquest/shared",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@nextquest/config": "workspace:*",
    "typescript": "^5.8.3",
    "eslint": "^10.1.0"
  }
}
```

- [ ] **Step 2: Create packages/shared/tsconfig.json**

```json
{
  "extends": "@nextquest/config/typescript",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/shared/src/types/user.ts**

```typescript
export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  locale: "fr" | "en";
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export type GameStatus = "wishlist" | "backlog" | "playing" | "completed" | "abandoned";
```

- [ ] **Step 4: Create packages/shared/src/validators/user.ts**

```typescript
import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  displayName: z.string().max(50).optional(),
  locale: z.enum(["fr", "en"]).default("fr"),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type Login = z.infer<typeof LoginSchema>;
```

- [ ] **Step 5: Create packages/shared/src/index.ts**

```typescript
export * from "./types/user.js";
export * from "./validators/user.js";
```

- [ ] **Step 6: Install and commit**

```bash
pnpm install
git add packages/shared/
git commit -m "feat: ajout package shared (types, validateurs Zod)"
```

---

### Task 4: Database package (Drizzle + PostgreSQL)

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/schema/users.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/seed.ts`

- [ ] **Step 1: Create packages/db/package.json**

```json
{
  "name": "@nextquest/db",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx src/seed.ts",
    "db:studio": "drizzle-kit studio",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "drizzle-orm": "^0.45.2",
    "postgres": "^3.4.8"
  },
  "devDependencies": {
    "@nextquest/config": "workspace:*",
    "drizzle-kit": "^0.31.10",
    "tsx": "^4.21.0",
    "typescript": "^5.8.3",
    "eslint": "^10.1.0"
  }
}
```

- [ ] **Step 2: Create packages/db/tsconfig.json**

```json
{
  "extends": "@nextquest/config/typescript",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src", "drizzle.config.ts"]
}
```

- [ ] **Step 3: Create packages/db/drizzle.config.ts**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 4: Create packages/db/src/client.ts**

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/users.js";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString);

export const db = drizzle(client, { schema });
export type Database = typeof db;
```

- [ ] **Step 5: Create packages/db/src/schema/users.ts**

```typescript
import { pgTable, uuid, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 30 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: varchar("display_name", { length: 50 }),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  locale: varchar("locale", { length: 5 }).notNull().default("fr"),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});
```

- [ ] **Step 6: Create packages/db/src/index.ts**

```typescript
export { db } from "./client.js";
export type { Database } from "./client.js";
export { users } from "./schema/users.js";
```

- [ ] **Step 7: Create packages/db/src/seed.ts**

```typescript
import { db } from "./client.js";
import { users } from "./schema/users.js";

async function seed() {
  console.log("Seeding database...");

  await db.insert(users).values([
    {
      email: "jb@nextquest.dev",
      username: "jb",
      passwordHash: "$2b$10$placeholder",
      displayName: "Jean-Baptiste",
      locale: "fr",
    },
    {
      email: "lorelei@nextquest.dev",
      username: "lorelei",
      passwordHash: "$2b$10$placeholder",
      displayName: "Lorelei",
      locale: "fr",
    },
  ]);

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
```

- [ ] **Step 8: Install and commit**

```bash
pnpm install
git add packages/db/
git commit -m "feat: ajout package db (Drizzle, schema users, seed)"
```

---

### Task 5: Docker Compose (PostgreSQL + Redis)

**Files:**
- Create: `docker/docker-compose.yml`
- Create: `docker/postgres/init.sql`

- [ ] **Step 1: Create docker/postgres/init.sql**

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

- [ ] **Step 2: Create docker/docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: nextquest-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: nextquest
      POSTGRES_USER: nextquest
      POSTGRES_PASSWORD: nextquest
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nextquest"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: nextquest-redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

- [ ] **Step 3: Create .env.example**

```env
# Base de donnees (correspond au docker-compose)
DATABASE_URL=postgresql://nextquest:nextquest@localhost:5432/nextquest

# Redis (correspond au docker-compose)
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=dev-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production

# API
PORT=3000
NODE_ENV=development
```

- [ ] **Step 4: Commit**

```bash
git add docker/ .env.example
git commit -m "feat: ajout Docker Compose (PostgreSQL + Redis) et .env.example"
```

---

### Task 6: Fastify API app

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/plugins/cors.ts`
- Create: `apps/api/src/plugins/swagger.ts`
- Create: `apps/api/src/modules/health/health.routes.ts`
- Create: `apps/api/src/modules/health/health.controller.ts`

- [ ] **Step 1: Create apps/api/package.json**

```json
{
  "name": "@nextquest/api",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@nextquest/shared": "workspace:*",
    "@nextquest/db": "workspace:*",
    "fastify": "^5.8.4",
    "@fastify/cors": "^11.2.0",
    "@fastify/swagger": "^9.7.0",
    "@fastify/swagger-ui": "^6.0.0",
    "@fastify/jwt": "^10.0.0",
    "@fastify/helmet": "^13.0.2",
    "@fastify/rate-limit": "^10.3.0",
    "ioredis": "^5.10.1",
    "zod": "^4.3.6",
    "dotenv": "^16.5.0"
  },
  "devDependencies": {
    "@nextquest/config": "workspace:*",
    "tsx": "^4.21.0",
    "typescript": "^5.8.3",
    "vitest": "^4.1.2",
    "supertest": "^7.2.2",
    "@types/supertest": "^6.0.2",
    "eslint": "^10.1.0"
  }
}
```

- [ ] **Step 2: Create apps/api/tsconfig.json**

```json
{
  "extends": "@nextquest/config/typescript",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create apps/api/src/plugins/cors.ts**

```typescript
import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";

export async function registerCors(app: FastifyInstance) {
  await app.register(cors, {
    origin: ["http://localhost:3001"],
    credentials: true,
  });
}
```

- [ ] **Step 4: Create apps/api/src/plugins/swagger.ts**

```typescript
import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "NextQuest API",
        description: "API de gestion de ludotheque videoludique",
        version: "0.1.0",
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });
}
```

- [ ] **Step 5: Create apps/api/src/modules/health/health.controller.ts**

```typescript
import type { FastifyReply, FastifyRequest } from "fastify";

export const healthController = {
  async check(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  },
};
```

- [ ] **Step 6: Create apps/api/src/modules/health/health.routes.ts**

```typescript
import type { FastifyInstance } from "fastify";
import { healthController } from "./health.controller.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string" },
            timestamp: { type: "string" },
          },
        },
      },
    },
    handler: healthController.check,
  });
}
```

- [ ] **Step 7: Create apps/api/src/server.ts**

```typescript
import "dotenv/config";
import Fastify from "fastify";
import { registerCors } from "./plugins/cors.js";
import { registerSwagger } from "./plugins/swagger.js";
import { healthRoutes } from "./modules/health/health.routes.js";

const app = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
    },
  },
});

async function start() {
  await registerCors(app);
  await registerSwagger(app);

  await app.register(healthRoutes, { prefix: "/api" });

  const port = Number(process.env.PORT) || 3000;

  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API running on http://localhost:${port}`);
  console.log(`Docs on http://localhost:${port}/docs`);
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
```

- [ ] **Step 8: Install and verify**

```bash
pnpm install
```

- [ ] **Step 9: Commit**

```bash
git add apps/api/
git commit -m "feat: ajout app API Fastify (health endpoint, swagger, cors)"
```

---

### Task 7: Nuxt web app

**Files:**
- Create: `apps/web/` (via nuxi init)
- Modify: `apps/web/package.json` (add workspace deps)
- Modify: `apps/web/nuxt.config.ts` (add Tailwind, port)

- [ ] **Step 1: Initialize Nuxt project**

```bash
cd apps
pnpm dlx nuxi@latest init web --packageManager pnpm --gitInit false
cd ..
```

- [ ] **Step 2: Update apps/web/package.json**

Add to the existing package.json generated by nuxi:
- Change `name` to `@nextquest/web`
- Add `"private": true`
- Add dependencies: `@nextquest/shared: "workspace:*"`
- Add devDependencies: `@nextquest/config: "workspace:*"`
- Add scripts: `"lint": "eslint ."`, `"typecheck": "nuxt typecheck"`

- [ ] **Step 3: Install Tailwind CSS for Nuxt**

```bash
pnpm --filter @nextquest/web add @nuxtjs/tailwindcss
```

- [ ] **Step 4: Update apps/web/nuxt.config.ts**

```typescript
export default defineNuxtConfig({
  compatibilityDate: "2026-03-31",
  devtools: { enabled: true },
  modules: ["@nuxtjs/tailwindcss"],
  devServer: {
    port: 3001,
  },
  runtimeConfig: {
    public: {
      apiUrl: "http://localhost:3000/api",
    },
  },
});
```

- [ ] **Step 5: Replace apps/web/app.vue**

```vue
<template>
  <div class="min-h-screen bg-black text-white flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-4xl font-bold text-orange-500">NextQuest</h1>
      <p class="mt-4 text-gray-400">Votre ludotheque videoludique</p>
    </div>
  </div>
</template>
```

- [ ] **Step 6: Install and commit**

```bash
pnpm install
git add apps/web/
git commit -m "feat: ajout app web Nuxt 3 + Tailwind CSS"
```

---

### Task 8: Expo mobile app

**Files:**
- Create: `apps/mobile/` (via create-expo-app)
- Modify: `apps/mobile/package.json` (add workspace deps)

- [ ] **Step 1: Initialize Expo project**

```bash
cd apps
pnpm dlx create-expo-app@latest mobile --template blank-typescript
cd ..
```

- [ ] **Step 2: Update apps/mobile/package.json**

- Change `name` to `@nextquest/mobile`
- Add `"private": true`
- Add dependencies: `@nextquest/shared: "workspace:*"`
- Add script: `"dev": "npx expo start"`

- [ ] **Step 3: Replace apps/mobile/App.tsx**

```tsx
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>NextQuest</Text>
      <Text style={styles.subtitle}>Votre ludotheque videoludique</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ff9a00",
  },
  subtitle: {
    fontSize: 16,
    color: "#9ca3af",
    marginTop: 16,
  },
});
```

- [ ] **Step 4: Install and commit**

```bash
pnpm install
git add apps/mobile/
git commit -m "feat: ajout app mobile Expo / React Native"
```

---

### Task 9: Turborepo pipeline config

**Files:**
- Create: `turbo.json`

- [ ] **Step 1: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", ".nuxt/**", ".output/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add turbo.json
git commit -m "feat: ajout config Turborepo (dev, build, lint, test)"
```

---

### Task 10: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  ci:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: nextquest_test
          POSTGRES_USER: nextquest
          POSTGRES_PASSWORD: nextquest
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test
        env:
          DATABASE_URL: postgresql://nextquest:nextquest@localhost:5432/nextquest_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret
          JWT_REFRESH_SECRET: test-refresh-secret
```

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "feat: ajout CI GitHub Actions (lint, typecheck, test)"
```

---

### Task 11: Update .gitignore and final verification

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Update .gitignore with monorepo patterns**

Add these patterns to the existing `.gitignore`:

```gitignore
# pnpm
pnpm-lock.yaml is tracked, but ignore store
.pnpm-store/

# Nuxt
.nuxt/
.output/

# Expo
.expo/

# Drizzle
migrations/meta/
```

- [ ] **Step 2: Delete old files that are no longer needed**

```bash
rm -f package-lock.json
rm -rf supabase/
rm -rf packages/database/
rm -f .env.local
```

- [ ] **Step 3: Final verification -- start Docker and API**

```bash
pnpm docker:up
sleep 3
DATABASE_URL=postgresql://nextquest:nextquest@localhost:5432/nextquest pnpm --filter @nextquest/api dev
```

Expected: API starts on port 3000, `curl http://localhost:3000/api/health` returns `{"status":"ok","timestamp":"..."}`

- [ ] **Step 4: Final verification -- start web**

In a separate terminal:

```bash
pnpm --filter @nextquest/web dev
```

Expected: Nuxt starts on port 3001, browser shows "NextQuest" title in orange.

- [ ] **Step 5: Generate first migration**

```bash
DATABASE_URL=postgresql://nextquest:nextquest@localhost:5432/nextquest pnpm db:generate
DATABASE_URL=postgresql://nextquest:nextquest@localhost:5432/nextquest pnpm db:migrate
DATABASE_URL=postgresql://nextquest:nextquest@localhost:5432/nextquest pnpm db:seed
```

Expected: `users` table created with 2 seed users.

- [ ] **Step 6: Commit everything**

```bash
git add -A
git commit -m "feat: scaffold complet du monorepo NextQuest"
git push origin main
```
