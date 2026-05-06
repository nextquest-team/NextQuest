# Docker -- Guide pour l'equipe NextQuest


## Pourquoi on utilise Docker dans NextQuest ?

On utilise Docker pour garantir que toute l'equipe a exactement les memes versions et la meme configuration :

1. **Les services partagés** (PostgreSQL, Redis)
2. **L'API Fastify** — service `api` en dev avec hot-reload via `tsx watch`
3. **L'application web** (Nuxt) — service `web` en dev avec hot-reload

Note : le mobile tourne toujours en local.

## Les fichiers Docker du projet

### docker-compose.yml

C'est le fichier principal. Il decrit quels services lancer et comment les configurer.

```yaml
# docker/docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: nextquest
      POSTGRES_USER: nextquest
      POSTGRES_PASSWORD: nextquest
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    image: node:22-alpine
    working_dir: /app
    command: sh -c "npm install -g pnpm && pnpm install && pnpm --filter @nextquest/api dev"
    ports:
      - "3000:3000"
    volumes:
      - ..:/app
      - api_modules:/app/node_modules
    env_file:
      - ../.env
    environment:
      - HOST=0.0.0.0
      - PORT=3000
      - DATABASE_URL=postgresql://nextquest:nextquest@postgres:5432/nextquest
      - REDIS_URL=redis://redis:6379
      - API_BASE_URL=http://api:3000
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  web:
    image: node:22-alpine
    working_dir: /app
    command: sh -c "npm install -g pnpm && pnpm install && pnpm --filter @nextquest/web dev"
    ports:
      - "3001:3001"
    volumes:
      - ..:/app
      - web_modules:/app/node_modules
      - web_nuxt:/app/apps/web/.nuxt
    environment:
      - HOST=0.0.0.0
      - PORT=3001
      - NUXT_API_BASE=http://api:3000
      - NUXT_PUBLIC_API_BASE=http://localhost:3000
    depends_on:
      - api

volumes:
  pgdata:
  api_modules:
  web_modules:
  web_nuxt:
```

Explication ligne par ligne :

**`image: postgres:16-alpine`**
On telecharge l'image officielle PostgreSQL version 16 (variante "alpine" = version legere). C'est comme dire "installe PostgreSQL 16" mais sans toucher a notre systeme.

**`ports: "5432:5432"`**
On "expose" le port 5432 du conteneur sur notre machine. Ca veut dire qu'on peut se connecter a PostgreSQL via `localhost:5432` comme si c'etait installe localement.

**`environment`**
Les variables d'environnement qui configurent PostgreSQL au demarrage : nom de la base, utilisateur, mot de passe. Ce sont les memes valeurs que dans notre fichier `.env`.

**`volumes: pgdata:/var/lib/postgresql/data`**
Les donnees de la base sont stockees dans un "volume" Docker. Sans ca, a chaque fois qu'on arrete le conteneur, toutes les donnees seraient perdues. Le volume les conserve entre les redemarrages.

**`volumes: ./postgres/init.sql`**
Un script SQL execute automatiquement a la premiere creation de la base. On y met les extensions PostgreSQL dont on a besoin (comme `uuid-ossp` pour generer des UUID).

**`redis:7-alpine`**
Meme principe pour Redis : version 7, variante legere, port 6379.

### Le service `api` (Fastify)

```yaml
api:
  image: node:22-alpine
  command: sh -c "npm install -g pnpm && pnpm install && pnpm --filter @nextquest/api dev"
  ports:
    - "3000:3000"
  env_file:
    - ../.env
  environment:
    - DATABASE_URL=postgresql://nextquest:nextquest@postgres:5432/nextquest
    - REDIS_URL=redis://redis:6379
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
```

**`env_file: ../.env`**
Charge toutes les variables du `.env` racine (JWT, secrets OAuth, etc.). Les variables `environment` du service surchargent ensuite les valeurs `localhost` par les noms de services Docker internes (`postgres`, `redis`).

**`depends_on` avec `condition: service_healthy`**
L'API ne démarre qu'une fois que postgres et redis ont répondu à leur healthcheck. Evite les crashs au démarrage si la base n'est pas encore prête.

**Double URL pour le web Nuxt :**

Le service `web` injecte deux variables :
- `NUXT_API_BASE=http://api:3000` — utilisé côté serveur (SSR, middleware), reste dans le réseau Docker
- `NUXT_PUBLIC_API_BASE=http://localhost:3000` — utilisé par le browser, qui ne connaît pas le réseau Docker interne

### Le service `web` (Nuxt 3)

```yaml
web:
  image: node:22-alpine
  working_dir: /app
  command: sh -c "npm install -g pnpm && pnpm install && pnpm --filter @nextquest/web dev"
  ports:
    - "3001:3001"
  volumes:
    - ..:/app
    - web_modules:/app/node_modules
    - web_nuxt:/app/apps/web/.nuxt
```

**`image: node:22-alpine`**
On part d'une image Node.js 22 minimale (pas besoin d'un Dockerfile dédié pour le dev, on installe pnpm a la volee dans la commande).

**`volumes: ..:/app`**
Le repertoire racine du monorepo est monte dans `/app` du conteneur. Quand tu modifies un fichier sur ta machine, le conteneur le voit immediatement → hot reload.

**`volumes: web_modules:/app/node_modules`**
Volumes nommes pour preserver les `node_modules` du conteneur (les dependances natives compilees pour Linux ne doivent pas etre ecrasees par celles de macOS/Windows).

**`ports: "3001:3001"`**
Le serveur Nuxt dev tourne sur le port 3001 du conteneur, accessible via `localhost:3001`.

**Important :** la premiere fois, le `pnpm install` peut prendre 1-2 minutes. Les fois suivantes, le volume `web_modules` accelere le demarrage.

### Le Dockerfile de production (apps/web/Dockerfile)

Pour deployer l'app web en production, on a un `Dockerfile` multi-stage :

1. **Stage builder** : installe pnpm, copie les sources du monorepo, lance `pnpm --filter @nextquest/web build` pour generer le bundle Nuxt optimise (`apps/web/.output/`).
2. **Stage runner** : ne contient que le `.output` Nuxt et lance `node server/index.mjs`.

L'image finale est tres legere (pas de devDependencies, pas de sources). Elle expose le port 3001 et peut etre deployee sur n'importe quel hebergeur compatible Docker (Fly.io, Railway, AWS ECS, etc.).

```bash
# Build de l'image production
docker build -f apps/web/Dockerfile -t nextquest-web .

# Run en local pour tester la prod
docker run -p 3001:3001 nextquest-web
```

### init.sql

```sql
-- docker/postgres/init.sql
-- Extensions necessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

Ce script s'execute une seule fois, quand le conteneur PostgreSQL est cree pour la premiere fois. Il active les extensions dont on a besoin.

## Commandes du quotidien

### Demarrer les services

```bash
pnpm docker:up
```

Ca lance **PostgreSQL, Redis, l'API et le web** en arriere-plan.
- API disponible sur [http://localhost:3000](http://localhost:3000)
- Swagger docs sur [http://localhost:3000/docs](http://localhost:3000/docs)
- Web disponible sur [http://localhost:3001](http://localhost:3001)

Pour ne lancer que les services BDD/cache (sans le web) :

```bash
docker compose -f docker/docker-compose.yml up -d postgres redis
```

On peut verifier qu'ils tournent :

```bash
docker ps
```

Ca affiche quelque chose comme :
```
CONTAINER ID   IMAGE              STATUS          PORTS
a1b2c3d4       postgres:16        Up 2 minutes    0.0.0.0:5432->5432/tcp
e5f6g7h8       redis:7-alpine     Up 2 minutes    0.0.0.0:6379->6379/tcp
```

### Arreter les services

```bash
pnpm docker:down
```

Ca arrete les conteneurs. Les donnees PostgreSQL sont conservees dans le volume.

### Tout supprimer et repartir de zero

```bash
pnpm docker:down
docker volume rm docker_pgdata
pnpm docker:up
pnpm db:migrate
pnpm db:seed
```

Ca supprime le volume (= toutes les donnees), puis recree tout proprement. Utile si la base est dans un etat bizarre et qu'on veut repartir de zero.

### Voir les logs d'un service

```bash
docker compose -f docker/docker-compose.yml logs postgres
docker compose -f docker/docker-compose.yml logs redis
```

Utile pour debugger si un service refuse de demarrer.

## Prerequis

Docker doit etre installe sur la machine. Deux options :

**Docker Desktop** (recommande)
- Telecharger sur https://www.docker.com/products/docker-desktop/
- Installer, lancer l'application
- C'est tout -- `docker` et `docker compose` sont disponibles dans le terminal

**Colima** (alternative legere pour Mac)
```bash
brew install colima docker docker-compose
colima start
```

Pour verifier que Docker fonctionne :
```bash
docker --version
docker compose version
```

## Redémarrer un service après ajout de dépendance

Quand on ajoute un nouveau module Nuxt (ex: `@nuxtjs/i18n`) ou une dépendance qui génère des types auto-import, il faut redémarrer le container `web` pour que `nuxt prepare` se relance et que les nouveaux types soient disponibles :

```bash
docker compose -f docker/docker-compose.yml restart web
```

Ou stopper/relancer complètement :

```bash
docker compose -f docker/docker-compose.yml up -d --force-recreate web
```

## Hot reload des nouveaux fichiers (polling Vite)

Sur macOS + Docker avec un volume monté, le watcher de fichiers natif ne détecte pas toujours les nouveaux fichiers créés depuis l'hôte. Le polling Vite est activé dans `nuxt.config.ts` :

```ts
vite: {
  server: {
    watch: { usePolling: true, interval: 1000 }
  }
}
```

Cela permet à Nuxt de détecter les nouveaux composants `.vue`, fichiers de traduction `locales/`, etc. sans redémarrer le container.

## Rappel : workflow complet de demarrage

```bash
git clone git@github.com:notre-org/nextquest.git
cd nextquest
cp .env.example .env        # Copie des variables d'environnement
pnpm install                 # Installation des dependances
pnpm docker:up               # Demarrage PostgreSQL + Redis
pnpm db:migrate              # Creation des tables
pnpm db:seed                 # Donnees de test
pnpm dev                     # Lancement de l'application
```


