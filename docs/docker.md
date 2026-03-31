# Docker -- Guide pour l'equipe NextQuest


## Pourquoi on utilise Docker dans NextQuest ?

On n'utilise Docker que pour les **services** (la base de donnees PostgreSQL et le cache Redis), pas pour notre code applicatif (API, web, mobile). Pourquoi cette separation ?

- **Les services doivent etre identiques** entre nos machines. Si j'ai PostgreSQL 16 et que Lorelei a PostgreSQL 15, on risque des bugs qui n'apparaissent que chez l'un des deux. Docker garantit qu'on a exactement la meme version avec la meme configuration.

- **Le code applicatif a besoin du hot-reload.** Quand on modifie un fichier TypeScript, on veut voir le changement instantanement dans le navigateur. Docker ajoute une couche qui ralentit ca. Donc le code tourne en local, directement sur notre machine.

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

volumes:
  pgdata:
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

Ca lance PostgreSQL et Redis en arriere-plan. On peut verifier qu'ils tournent :

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


