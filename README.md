# NextQuest

Application web et mobile de gestion de ludotheque videoludique.

NextQuest permet aux joueurs de centraliser leur collection de jeux depuis plusieurs plateformes (Steam, PSN, Xbox, Nintendo, Epic), suivre leur progression, recevoir des recommandations personnalisees et interagir avec d'autres joueurs.

## Equipe

- **Lorelei** -- Design UI/UX, maquettes, developpement frontend (web + mobile)
- **Jean-Baptiste** -- Developpement backend, architecture technique, base de donnees

## Stack technique

**Backend**
- Node.js 22 LTS
- TypeScript (strict)
- Fastify 5
- Drizzle ORM
- PostgreSQL 16
- Redis 7
- Zod (validation)
- JWT (authentification)

**Frontend web**
- Nuxt 3 / Vue.js 3
- Tailwind CSS

**Mobile** -- Expo / React Native

**Outils**
- pnpm + Turborepo (monorepo)
- Docker Compose (PostgreSQL + Redis en local)
- ESLint 9 + Prettier
- Vitest + Supertest (tests)
- GitHub Actions (CI/CD)

## Structure du projet

```
nextquest/
├── apps/
│   ├── web/              # Application web (Nuxt / Vue.js)
│   ├── mobile/           # Application mobile (Expo)
│   └── api/              # API Fastify
├── packages/
│   ├── shared/           # Types, validations Zod, utilitaires
│   ├── db/               # Schema Drizzle, migrations
│   └── config/           # Configs ESLint, TS, Prettier partagees
├── docker/
│   └── docker-compose.yml
└── docs/
    ├── specs/            # Specifications techniques
    ├── database/         # Schema BDD
    └── mockups/          # Maquettes HTML
```

## Demarrage rapide

### Prerequis

- Node.js 22 LTS
- pnpm (`npm install -g pnpm`)
- Docker ([guide d'installation](docs/docker.md))

### Installation

```bash
git clone git@github.com:Jeeiib/NextQuest.git
cd NextQuest
cp .env.example .env
pnpm install
pnpm docker:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Documentation

- [Architecture et environnement de dev](docs/specs/environnementDev.md) -- Explication complete de chaque choix technique
- [Guide Docker](docs/docker.md) -- Comment fonctionne Docker dans le projet
- [Schema BDD](docs/database/schema.dbml) -- Schema relationnel complet (20+ tables)

## Conventions

- **TypeScript strict** partout
- **Conventional Commits** : `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- **Branches** : `main` (prod), `develop` (integration), `feature/*`, `fix/*`
- **PR obligatoires** avec code review avant merge

## Contexte

Projet de certification CDA (Concepteur Developpeur d'Applications) chez ForEach Academy -- soutenance juillet 2027.
