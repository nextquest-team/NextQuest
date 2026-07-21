# NextQuest

Application web et mobile de gestion de ludotheque videoludique.

NextQuest permet aux joueurs de centraliser leur collection de jeux depuis plusieurs plateformes (Steam, PSN, Xbox, Nintendo, Epic), suivre leur progression, recevoir des recommandations personnalisees et interagir avec d'autres joueurs.

## Equipe

- **Lorelei** -- Design UI/UX, maquettes, developpement frontend (web + mobile)
- **Jean-Baptiste** -- Developpement backend, architecture technique, base de donnees

## Stack technique

| Couche | Technologie | Role |
|--------|-------------|------|
| API | Fastify 5 / Node.js 22 | Serveur backend REST |
| Web | Nuxt 3 / Vue.js 3 | Application web |
| Mobile | Expo / React Native | Application iOS + Android |
| BDD | PostgreSQL 16 | Base de donnees relationnelle (34 tables) |
| Cache | Redis 7 | Rate limiting, cache API, sessions courtes |
| ORM | Drizzle | Schema TypeScript, migrations automatiques |
| Validation | Zod | Validation des donnees partagee front/back |
| Auth | JWT + Argon2id | Access token 15min + refresh token 30j |
| Tests | Vitest + Supertest | Tests unitaires + integration |
| Monorepo | pnpm + Turborepo | Partage de code entre apps |
| Infra dev | Docker Compose | PostgreSQL + Redis en local |
| CI/CD | GitHub Actions | Lint, typecheck, tests automatiques |

## Structure du projet

```
nextquest/
├── apps/
│   ├── api/              # API Fastify (routes, auth, middleware)
│   ├── web/              # Application web (Nuxt / Vue.js)
│   └── mobile/           # Application mobile (Expo)
├── packages/
│   ├── db/               # Schema Drizzle (14 fichiers), migrations
│   ├── shared/           # Types, validations Zod, utilitaires
│   └── config/           # Configs ESLint, TS, Prettier partagees
├── docker/
│   └── docker-compose.yml  # PostgreSQL 16 + Redis 7
└── docs/
    ├── database/         # Schema DBML (reference BDD)
    ├── journal-jb.md     # Journal de bord backend
    └── specs/            # Specifications techniques
```

## Demarrage rapide

### Prerequis

- **Node.js 22 LTS** -- [nodejs.org](https://nodejs.org)
- **pnpm** -- `npm install -g pnpm`
- **Docker Desktop** -- [docker.com](https://www.docker.com/products/docker-desktop)

### Installation

```bash
# 1. Cloner le repo
git clone git@github.com:nextquest-team/NextQuest.git
cd NextQuest

# 2. Installer les dependances
pnpm install

# 3. Configurer l'environnement
cp .env.example .env
# Les valeurs par defaut fonctionnent avec Docker local

# 4. Demarrer PostgreSQL + Redis
docker compose -f docker/docker-compose.yml up -d

# 5. Creer les tables dans la BDD
pnpm --filter @nextquest/db db:migrate

# 6. Lancer le projet
pnpm dev
```

### URLs locales

Une fois lance, voici les URLs disponibles :

| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| **Swagger UI (doc API)** | **http://localhost:3000/docs** |
| Spec OpenAPI (JSON) | http://localhost:3000/docs/json |
| Spec OpenAPI (YAML) | http://localhost:3000/docs/yaml |
| Health check | http://localhost:3000/api/health |
| Drizzle Studio (BDD) | https://local.drizzle.studio (apres `pnpm --filter @nextquest/db db:studio`) |
| Web (Nuxt) | http://localhost:3001 |

### Commandes utiles

```bash
pnpm dev                              # Lancer toutes les apps en dev
pnpm dev --filter web                 # Lancer uniquement le web
pnpm dev --filter api                 # Lancer uniquement l'API
pnpm build                            # Build de production
pnpm lint                             # Verifier le code
pnpm test                             # Lancer les tests

# Base de donnees
pnpm --filter @nextquest/db db:generate   # Generer une migration apres modif du schema
pnpm --filter @nextquest/db db:migrate    # Appliquer les migrations
pnpm --filter @nextquest/db db:studio     # Ouvrir l'interface visuelle de la BDD

# Docker
docker compose -f docker/docker-compose.yml up -d     # Demarrer PostgreSQL + Redis
docker compose -f docker/docker-compose.yml down       # Arreter
docker compose -f docker/docker-compose.yml down -v    # Arreter + supprimer les donnees
```

## Base de donnees

Le schema complet est dans `docs/database/schema.dbml` (visualisable sur [dbdiagram.io](https://dbdiagram.io)).

Le code Drizzle correspondant est dans `packages/db/src/schema/` :

| Fichier | Tables | Description |
|---------|--------|-------------|
| `enums.ts` | -- | 17 enums PostgreSQL (roles, statuts, types) |
| `services.ts` | platforms, services, genres, tags | Referentiels (plateformes, services gaming, genres, tags) |
| `users.ts` | users, auth_providers, sessions, verification_tokens, connected_services | Authentification et comptes utilisateur |
| `games.ts` | games, game_platforms, game_genres, game_tags, game_updates | Catalogue de jeux |
| `collection.ts` | user_games, user_game_tags, user_game_status_history | Bibliotheque personnelle |
| `achievements.ts` | external_achievements, badges, user_badges | Succes et badges |
| `social.ts` | friendships | Systeme d'amis |
| `messaging.ts` | conversations, conversation_members, messages | Messagerie |
| `notifications.ts` | notifications, notification_preferences, user_devices | Notifications + push mobile |
| `activities.ts` | activities | Fil d'actualite |
| `recommendations.ts` | recommendations | Recommandations (moteur algorithmique) |
| `audit.ts` | audit_logs | Journal de securite (OWASP) |
| `gdpr.ts` | user_consents, gdpr_requests | Conformite RGPD |
| `moderation.ts` | reports | Signalements et moderation |

## Comment ca marche (pour Lorelei)

### Le monorepo

Un seul repo Git avec tout le code. Les 3 apps (API, web, mobile) partagent du code via les `packages/` :
- Un type `User` modifie dans `packages/shared/` est immediatement disponible dans l'API, le web et le mobile
- Les validateurs Zod (ex: `CreateUserSchema`) sont ecrits une fois et utilises partout

### La base de donnees

Le schema est ecrit **en TypeScript** dans `packages/db/src/schema/`. Drizzle ORM le traduit en SQL automatiquement :
1. Tu modifies un fichier TypeScript (ex: ajouter une colonne)
2. `pnpm --filter @nextquest/db db:generate` -- Drizzle genere le SQL (`ALTER TABLE ...`)
3. `pnpm --filter @nextquest/db db:migrate` -- Drizzle applique le SQL sur PostgreSQL

Pas besoin d'ecrire du SQL a la main. Le schema vit dans le code, versionne dans Git.

### Docker

Docker fait tourner PostgreSQL et Redis sur ta machine sans les installer. C'est comme une "mini-VM" isolee. Tu lances `docker compose up -d` et c'est pret.

### L'authentification

Les utilisateurs se connectent via email/mot de passe ou via Google/Microsoft (OAuth). Les connexions aux plateformes gaming (Steam, PSN, Xbox) sont un module separe pour importer la bibliotheque de jeux, pas pour s'authentifier.

JWT access token (15 min) + refresh token rotatif 30 jours (cookie HttpOnly pour le web, body pour le mobile). Password hashe en Argon2id, OAuth Authorization Code cote serveur. Detail de chaque endpoint et schema des reponses dans **Swagger : http://localhost:3000/docs**.

| Endpoint | Use case |
|----------|----------|
| `POST /api/auth/register` | Inscription email/password |
| `POST /api/auth/login` | Connexion email/password |
| `POST /api/auth/refresh` | Renouveler les tokens (rotation auto, detection de vol) |
| `POST /api/auth/logout` | Deconnexion de la session courante |
| `POST /api/auth/logout-all` | Deconnexion de toutes les sessions |
| `GET /api/auth/me` | Profil du user connecte |
| `GET /api/auth/oauth/:provider` | Demarrer un flow OAuth (`google` ou `microsoft`) |
| `GET /api/auth/oauth/:provider/callback` | Callback OAuth (appele par le provider) |
| `POST /api/auth/oauth/:provider/link` | Lier un provider a un compte existant |
| `DELETE /api/auth/oauth/:provider/link` | Delier un provider |

## Documentation

- [Guide Docker](docs/docker.md) -- Comment fonctionne Docker dans le projet
- [Schema BDD (DBML)](docs/database/schema.dbml) -- Schema relationnel complet (34 tables)
- [Journal backend (JB)](docs/journal-jb.md) -- Historique des decisions backend
- [Configuration GitHub](docs/setup-github.md) -- Etat de la config GitHub (rulesets, Dependabot, scanning)

## Conventions

- **TypeScript strict** partout
- **Conventional Commits** : `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- **Branches** : `main` (prod), `develop` (integration), `feature/*`, `fix/*`
- **PR obligatoires** avec code review avant merge

## Workflow PR et CI

Chaque feature passe par une PR vers `develop`. L'autre dev review pour comprendre le changement et valider la qualite.

### CI automatique (GitHub Actions)

A chaque push ou PR sur `develop` / `main`, la CI verifie :

| Etape | Description |
|-------|-------------|
| Lint | `pnpm lint` -- ESLint sur tous les packages |
| Typecheck | `pnpm typecheck` -- TypeScript strict sur tous les packages |
| Migrations | Applique les migrations Drizzle sur une BDD Postgres ephemere |
| Tests | `pnpm test` -- Vitest avec Postgres + Redis services |
| Build | `pnpm build` -- compile le code de production |

Les services Postgres 16 et Redis 7 sont demarres dans le runner GitHub. La CI doit etre verte avant tout merge.

### Securite et qualite

- **CodeQL** -- analyse statique GitHub (OWASP Top 10) qui tourne a chaque PR et chaque lundi. Resultats dans l'onglet **Security** du repo.
- **Dependabot** -- ouvre automatiquement des PRs pour mettre a jour les dependances (npm + GitHub Actions). Les patches/minor sont groupes en une PR par semaine.
- **Secret scanning** -- active par defaut sur les repos publics, alerte si un secret est commit par erreur.

### Templates et reviewers

- **PR template** (`.github/PULL_REQUEST_TEMPLATE.md`) -- chaque nouvelle PR est pre-remplie avec les sections obligatoires (Resume, Changements, Comment tester, Checklist).
- **CODEOWNERS** (`.github/CODEOWNERS`) -- ajoute automatiquement les reviewers selon les fichiers modifies (back -> JB, front -> Lorelei, partage -> les deux).

## Contexte

Projet de certification CDA (Concepteur Developpeur d'Applications) chez ForEach Academy -- soutenance juillet 2027.
