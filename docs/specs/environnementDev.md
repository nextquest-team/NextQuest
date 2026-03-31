# NextQuest -- Architecture et Environnement de Developpement

**Date :** 31 mars 2026
**Par :** Jean-Baptiste
**Pour :** Lorelei et moi-meme
**Contexte :** Projet de certification CDA -- soutenance juillet 2027

J'ai pose les bases de notre architecture technique pour NextQuest. Ce document explique chaque choix en partant de ce qu'on connait deja (DWWM et CDA chez ForEach) pour montrer pourquoi j'ai choisi telle ou telle techno et ce que ca change concretement pour nous.

---

## Table des matieres

1. [Vue d'ensemble](#1-vue-densemble)
2. [Le monorepo -- pourquoi et comment](#2-le-monorepo--pourquoi-et-comment)
3. [Stack technique -- chaque choix explique](#3-stack-technique--chaque-choix-explique)
4. [Architecture de l'API -- les couches](#4-architecture-de-lapi--les-couches)
5. [Environnement de dev -- Docker et scripts](#5-environnement-de-dev--docker-et-scripts)
6. [Workflow d'equipe -- Git, PR, CI/CD](#6-workflow-dequipe--git-pr-cicd)
7. [Securite -- OWASP et bonnes pratiques](#7-securite--owasp-et-bonnes-pratiques)
8. [Deploiement](#8-deploiement)
9. [Le choix frontend -- React vs Vue](#9-le-choix-frontend--react-vs-vue-a-decider-ensemble)

---

## 1. Vue d'ensemble

NextQuest est une application web + mobile de gestion de ludotheque videoludique. Les joueurs peuvent :
- Centraliser leur collection de jeux depuis plusieurs plateformes (Steam, PSN, Xbox, Nintendo, Epic)
- Suivre leur progression (a faire, en cours, termine, abandonne)
- Recevoir des recommandations personnalisees
- Interagir socialement avec d'autres joueurs

**Notre equipe :**
- **Lorelei** -- Design UI/UX, maquettes, developpement frontend (web + mobile)
- **Jean-Baptiste** -- Developpement backend, architecture technique, base de donnees

On fait chacun notre domaine principal, mais on ira aussi faire des interventions dans le domaine de l'autre.

---

## 2. Le monorepo -- pourquoi et comment

### Ce qu'on connait

En DWWM, nos projets avaient un seul dossier, ou alors un repo pour le front et un pour le back. Quand on veut partager du code (par exemple un type `User` utilise a la fois par le front et le back), on doit copier-coller ou publier un package npm -- c'est lourd et ca desynchronise.

### Ce qu'on fait et pourquoi

Un **monorepo** = un seul depot Git qui contient TOUTES les applications du projet (web, mobile, API) et des packages partages. Ce n'est PAS "tout dans un seul dossier" -- chaque app est independante, mais elles peuvent importer du code commun directement.

**Analogie :** Imagine un immeuble avec des appartements independants (les apps) mais des parties communes (les packages partages) -- electricite, eau, internet. Chaque appartement fonctionne seul, mais les ressources communes evitent de tout installer en double.

### Structure concrete

```
nextquest/
├── apps/                          # Les applications independantes
│   ├── web/                       # [Lorelei] Application web
│   ├── mobile/                    # [Lorelei] Application mobile
│   └── api/                       # [JB] API backend
│
├── packages/                      # Code partage entre les apps
│   ├── shared/                    # Types, validations, utilitaires
│   ├── db/                        # Schema de BDD, migrations
│   └── config/                    # Configs ESLint, TypeScript, Prettier
│
├── docker/                        # Services (PostgreSQL, Redis)
│   ├── docker-compose.yml
│   └── postgres/
│       └── init.sql
│
├── .github/
│   └── workflows/                 # CI/CD automatique
│       └── ci.yml
│
├── turbo.json                     # Config Turborepo (builds paralleles)
├── pnpm-workspace.yaml            # Definition du workspace
├── package.json                   # Scripts globaux
├── .nvmrc                         # Version Node.js fixee
├── .env.example                   # Template de variables d'environnement
└── README.md                      # Documentation projet
```

### Ce que ca change concretement

- **Un seul `git clone`** et tout le projet est la (front, back, mobile, BDD)
- **Un seul `pnpm install`** installe les dependances de toutes les apps
- **Le type `Game` defini dans `packages/shared/`** est utilise tel quel dans l'API, le web et le mobile -- zero copier-coller, zero desynchronisation
- **Si je modifie un type cote API**, le front de Lorelei voit immediatement l'erreur TypeScript -- pas besoin d'attendre un deploiement pour decouvrir que ca a casse

### Les outils du monorepo

#### pnpm (remplace npm)

**Ce qu'on connait :** `npm install`, `npm run dev`

**Pourquoi pnpm :** npm installe les dependances en dupliquant les fichiers. Sur un monorepo avec 3 apps qui utilisent toutes React, npm installerait React 3 fois. pnpm utilise un systeme de liens symboliques -- chaque dependance n'est stockee qu'une seule fois sur le disque. Le monorepo reste leger et les installations sont 2-3x plus rapides.

**En pratique :** Les commandes sont quasi identiques : `pnpm install`, `pnpm dev`, `pnpm add zod`. La seule difference notable c'est le filtre : `pnpm dev --filter web` lance seulement l'app web.

#### Turborepo (orchestrateur de builds)

**Ce qu'on connait :** rien d'equivalent en DWWM, c'est un outil specifique aux monorepos.

**Ce que ca fait :** Quand on lance `pnpm build`, Turborepo sait dans quel ordre builder les packages (d'abord `shared`, puis `db`, puis les apps qui en dependent). Et il **met en cache** les resultats -- si `packages/shared/` n'a pas change depuis le dernier build, il ne le rebuild pas. Ca fait passer les builds de minutes a secondes.

**En pratique :** On ne touche quasiment jamais a Turborepo directement. C'est configure une fois dans `turbo.json` et ca tourne en arriere-plan.

---

## 3. Stack technique -- chaque choix explique

### Node.js 22 LTS (runtime)

**Ce qu'on connait :** Node.js depuis le DWWM (203H de backend).

**Pourquoi la version 22 LTS :** LTS = Long Term Support, c'est la version stable recommandee pour la production. Elle sera supportee jusqu'en avril 2027 -- bien apres notre soutenance. On fixe la version dans `.nvmrc` pour qu'on utilise tous exactement la meme.

### TypeScript strict (langage)

**Ce qu'on connait :** JavaScript en DWWM, introduction a TypeScript en CDA (28H JS/TS).

**Pourquoi TypeScript strict :** TypeScript ajoute des types a JavaScript. Le mode `strict` active toutes les verifications -- c'est plus exigeant au debut, mais ca attrape les bugs AVANT l'execution. Sur un projet a deux c'est indispensable : quand je change le format d'une reponse API, TypeScript dit immediatement a Lorelei "attention, ce champ n'existe plus" au lieu de crasher en production.

**Exemple concret :**
```typescript
// Sans TypeScript : ca crash en production
const user = await fetch('/api/users/1')
const data = await user.json()
console.log(data.username) // undefined si le champ a ete renomme

// Avec TypeScript strict : erreur AVANT l'execution
import type { User } from '@nextquest/shared'
const data: User = await api.get('/users/1')
console.log(data.username) // Erreur TS si 'username' n'existe pas dans le type User
```

### Fastify (framework HTTP pour l'API)

**Ce qu'on connait :** Express (203H en DWWM). Express est LE framework Node.js classique -- on sait creer des routes, des middlewares, envoyer des reponses JSON.

**Pourquoi Fastify au lieu d'Express :**

- **Performance :** Express fait ~15 000 req/sec. Fastify fait ~45 000 req/sec -- 3x plus rapide.
- **TypeScript :** Express a ete concu en JavaScript, le typage est ajoute apres coup et partiel. Fastify est concu pour TypeScript, tout est type nativement.
- **Validation :** Express n'a rien d'integre, il faut ajouter express-validator ou Joi. Fastify a la validation de schema integree (on branche Zod dessus).
- **Documentation API :** Avec Express il faut ajouter swagger-ui-express et tout configurer a la main. Avec Fastify, `@fastify/swagger` genere la doc automatiquement depuis les schemas.
- **Plugins :** Express utilise des middlewares globaux (parfois des conflits). Fastify a un systeme de plugins encapsules (pas de conflits).
- **Maintenance :** Le dernier changement majeur d'Express date de 2014 (Express 4). Fastify est activement maintenu avec la v5 sortie en 2025.

**Concretement, a quoi ca ressemble :**
```typescript
// Express (ce qu'on connait)
app.get('/api/games/:id', async (req, res) => {
  const game = await getGame(req.params.id)
  res.json(game)
})

// Fastify (tres similaire, mais avec validation integree)
app.get('/api/games/:id', {
  schema: {
    params: z.object({ id: z.string().uuid() }),
    response: { 200: GameSchema }
  },
  handler: async (request, reply) => {
    const game = await getGame(request.params.id)
    return game
  }
})
```

La syntaxe est proche d'Express. La grosse difference c'est le `schema` : Fastify valide automatiquement les parametres et la reponse. Si quelqu'un appelle `/api/games/pas-un-uuid`, Fastify renvoie une erreur 400 sans qu'on ecrive une seule ligne de validation.

### Drizzle ORM (acces base de donnees)

**Ce qu'on connait :** SQL brut en DWWM (28H de BDD), peut-etre Sequelize. En CDA, 35H de BDD avancees (index, vues, procedures stockees).

**Pourquoi un ORM :** Ecrire du SQL brut ca marche, mais c'est risque (injections SQL si on concatene des strings) et ce n'est pas type-safe (TypeScript ne sait pas ce que la requete retourne). Un ORM ecrit les requetes pour nous et garantit les types.

**Pourquoi Drizzle plutot que Prisma (l'autre ORM populaire) :**

- **Schema :** Prisma utilise un langage custom (`.prisma`) qu'il faut apprendre. Drizzle utilise du TypeScript pur -- on connait deja le langage.
- **Requetes :** Prisma abstrait fortement le SQL, on ne reconnait plus la requete. Drizzle ressemble a du SQL traduit en TS, on reconnait la logique.
- **Generation :** Prisma oblige a relancer `prisma generate` a chaque changement de schema. Drizzle n'a pas de generation, les types sont immediats.
- **Performance :** Prisma passe par un "engine" Rust intermediaire qui ajoute de la latence. Drizzle envoie des requetes SQL directes, c'est plus leger.
- **Pour le jury CDA :** Prisma cache trop le SQL, le jury peut douter de notre maitrise. Avec Drizzle, les requetes sont lisibles en SQL, on peut les expliquer.

**Exemple concret :**
```typescript
// SQL brut (ce qu'on connait)
SELECT g.title, g.cover_url, ug.status
FROM games g
JOIN user_games ug ON g.id = ug.game_id
WHERE ug.user_id = $1 AND ug.status = 'playing'

// Drizzle (meme logique, mais type-safe)
const myGames = await db
  .select({
    title: games.title,
    coverUrl: games.coverUrl,
    status: userGames.status
  })
  .from(games)
  .innerJoin(userGames, eq(games.id, userGames.gameId))
  .where(
    and(
      eq(userGames.userId, userId),
      eq(userGames.status, 'playing')
    )
  )
// TypeScript sait que myGames est de type { title: string, coverUrl: string, status: string }[]
```

C'est du SQL "traduit" en TypeScript. Si le jury nous demande "qu'est-ce que cette requete fait ?", on peut repondre aussi facilement qu'avec du SQL brut.

### PostgreSQL 16 (base de donnees)

**Ce qu'on connait :** SQL et bases relationnelles depuis le DWWM (28H), approfondies en CDA (35H BDD avancees).

**Pourquoi PostgreSQL :** C'est LA base de donnees relationnelle de reference en 2026. Gratuite, open source, extremement robuste. Le schema DBML qu'on a deja concu (20+ tables, relations, enums) est parfaitement adapte a PostgreSQL.

**Pourquoi pas Supabase :** Supabase est un "Backend as a Service" qui fournit PostgreSQL + auth + storage cles en main. C'est pratique, mais pour un projet CDA le jury veut voir qu'on sait construire l'API, gerer l'authentification, ecrire les migrations. Utiliser Supabase reviendrait a montrer qu'on sait configurer un service, pas qu'on sait developper.

### Redis 7 (cache)

**Ce qu'on connait :** probablement rien d'equivalent en DWWM.

**Ce que c'est :** Redis est une base de donnees "en memoire" -- ultra-rapide (microsecondes au lieu de millisecondes pour PostgreSQL). On ne stocke pas les donnees principales dedans, mais des donnees temporaires.

**A quoi ca sert concretement dans NextQuest :**
- **Cache API :** Les metadonnees d'un jeu (titre, image, description) ne changent pas souvent. Au lieu de requeter IGDB a chaque fois, on stocke le resultat dans Redis pendant 24H. La prochaine requete est instantanee.
- **Sessions / rate limiting :** Compter le nombre de requetes d'un utilisateur (pour bloquer le brute force) sans surcharger PostgreSQL.
- **Refresh tokens :** Stocker les tokens de rafraichissement avec une expiration automatique (Redis supprime la cle tout seul apres 7 jours).

### Zod (validation)

**Ce qu'on connait :** Validation manuelle avec des `if/else` ou `express-validator` en DWWM.

**Ce que c'est :** Une librairie qui definit des "schemas" de validation. Un schema decrit la forme exacte d'une donnee (quels champs, quels types, quelles contraintes).

**Pourquoi c'est indispensable :**
```typescript
// Sans Zod : validation manuelle, fragile, pas de types
app.post('/api/games', (req, res) => {
  if (!req.body.title || typeof req.body.title !== 'string') {
    return res.status(400).json({ error: 'title requis' })
  }
  if (req.body.title.length > 200) {
    return res.status(400).json({ error: 'title trop long' })
  }
  // ... 20 lignes de validation pour chaque champ
})

// Avec Zod : declaratif, clair, et ca genere les types TypeScript
const CreateGameSchema = z.object({
  title: z.string().min(1).max(200),
  platformId: z.string().uuid(),
  status: z.enum(['wishlist', 'backlog', 'playing', 'completed', 'abandoned']),
  rating: z.number().int().min(1).max(10).optional()
})

// Le type TypeScript est genere automatiquement
type CreateGame = z.infer<typeof CreateGameSchema>
// = { title: string, platformId: string, status: 'wishlist' | 'backlog' | ..., rating?: number }
```

**Le gros avantage :** Le meme schema Zod sert a la fois dans l'API (validation des requetes) et dans le frontend (validation des formulaires). On le met dans `packages/shared/` et on l'utilise partout. Zero duplication.

### Vitest + Supertest (tests)

**Ce qu'on connait :** Tests unitaires basiques en DWWM, approfondis en CDA (35H qualite logicielle -- pyramide des tests, mocks).

**Pourquoi Vitest au lieu de Jest :**

- **Vitesse :** Jest est lent car il transforme le code avant de le tester. Vitest utilise le meme moteur que Vite, pas de transformation, c'est beaucoup plus rapide.
- **ESM :** Jest a un support bancal des modules ES (il faut des configs speciales). Vitest les supporte nativement.
- **Config :** Jest pose souvent des problemes de config avec TypeScript. Vitest fonctionne out-of-the-box avec TypeScript.
- **API :** L'API est exactement la meme (`describe`, `it`, `expect`). Si on a deja utilise Jest, on sait utiliser Vitest. C'est juste plus rapide et plus simple a configurer.

**Supertest** sert a tester les endpoints API sans lancer de vrai serveur. On fait `request(app).get('/api/games').expect(200)` et ca simule une requete HTTP.

### ESLint 9 + Prettier (qualite de code)

**Ce qu'on connait :** Peut-etre ESLint basique en DWWM.

**Pourquoi c'est important a deux :** Sans regles communes, j'ecris `const x = "hello"` (guillemets doubles) et Lorelei ecrit `const x = 'hello'` (guillemets simples). Chaque PR a des dizaines de changements de formatage qui polluent le diff. Avec ESLint + Prettier configures dans `packages/config/`, on formate tous pareil automatiquement. Les PR ne contiennent que du vrai code, pas du bruit de formatage.

---

## 4. Architecture de l'API -- les couches

### Ce qu'on faisait en DWWM

Avec Express, on mettait probablement tout dans le fichier de route :

```typescript
// Approche DWWM typique : tout au meme endroit
router.get('/games/:id', async (req, res) => {
  const game = await db.query('SELECT * FROM games WHERE id = $1', [req.params.id])
  if (!game) return res.status(404).json({ error: 'Not found' })
  res.json(game)
})
```

Ca marche pour un petit projet. Mais quand l'app grandit (20+ tables, des regles metier complexes, de la securite), tout melanger dans les routes devient immaintenable.

### Ce qu'on fait maintenant : architecture en couches

Le referentiel CDA (bloc 2) demande explicitement une "application organisee en couches". Voici les notres :

```
Requete HTTP
    |
    v
[Route]           Declare l'endpoint et son schema de validation
    |
    v
[Controller]      Recoit la requete, appelle le service, formate la reponse
    |
    v
[Service]         Logique metier pure (pas d'acces HTTP ni BDD)
    |
    v
[Repository]      Requetes Drizzle vers PostgreSQL
    |
    v
[Database]        packages/db -- schema, client, migrations
```

### Exemple concret avec le module "games"

```
apps/api/src/modules/games/
├── games.routes.ts          # Quel endpoint ? Quel schema ?
├── games.controller.ts      # Qui orchestre ?
├── games.service.ts         # Quelle logique metier ?
├── games.repository.ts      # Quelles requetes BDD ?
└── games.schema.ts          # Quelles validations ?
```

**games.routes.ts** -- "Quand quelqu'un appelle GET /api/games/:id, utilise ce schema et ce controller"
```typescript
export async function gamesRoutes(app: FastifyInstance) {
  app.get('/:id', {
    schema: { params: GetGameParamsSchema, response: { 200: GameResponseSchema } },
    handler: gamesController.getById
  })
}
```

**games.controller.ts** -- "Prends l'ID de la requete, demande au service, renvoie la reponse"
```typescript
async getById(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params
  const game = await gamesService.findById(id)
  return reply.send(game)
}
```

**games.service.ts** -- "Verifie les regles metier, puis demande au repository"
```typescript
async findById(id: string) {
  const game = await gamesRepository.findById(id)
  if (!game) throw new NotFoundError('Game not found')
  return game
}
```

**games.repository.ts** -- "Execute la requete Drizzle"
```typescript
async findById(id: string) {
  return db.query.games.findFirst({
    where: eq(games.id, id),
    with: { platforms: true, genres: true }
  })
}
```

### Pourquoi cette separation

- **Testabilite :** On peut tester le service sans base de donnees (on "mock" le repository). On peut tester le repository sur une vraie BDD de test. Chaque couche se teste independamment.
- **Lisibilite :** Quand Lorelei veut comprendre "comment l'API renvoie un jeu", elle lit le controller. Quand je veux optimiser une requete, je vais dans le repository. On sait ou chercher.
- **Securite :** La validation se fait dans la route (schema Zod), l'autorisation dans le controller (est-ce que cet utilisateur a le droit ?), la logique dans le service. Chaque couche a sa responsabilite.
- **Jury CDA :** C'est exactement ce que le bloc 2 demande. On pourra dessiner ce schema en soutenance et expliquer le role de chaque couche.

---

## 5. Environnement de dev -- Docker et scripts

### Docker Compose -- les services locaux

**Ce qu'on connait :** Docker est au programme CDA (35H DevOps). Docker permet de lancer des applications dans des "conteneurs" isoles -- comme des mini machines virtuelles mais plus legeres.

**Ce qu'on en fait :** On utilise Docker UNIQUEMENT pour les services (PostgreSQL et Redis), pas pour le code applicatif. Pourquoi ? Parce que les services doivent etre identiques entre nos machines (meme version PostgreSQL, meme config), mais le code applicatif a besoin du hot-reload (les modifications apparaissent instantanement sans rebuilder).

```yaml
# docker/docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine     # Meme version pour tout le monde
    ports:
      - "5432:5432"               # Accessible sur localhost:5432
    environment:
      POSTGRES_DB: nextquest
      POSTGRES_USER: nextquest
      POSTGRES_PASSWORD: nextquest
    volumes:
      - pgdata:/var/lib/postgresql/data    # Donnees persistees
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:                         # Les donnees survivent au redemarrage
```

### Onboarding : 6 commandes pour demarrer

Quand Lorelei (ou moi sur une nouvelle machine) clone le projet pour la premiere fois :

```bash
git clone git@github.com:notre-org/nextquest.git
cd nextquest
cp .env.example .env           # Copie le template d'env (secrets locaux)
pnpm install                   # Installe toutes les dependances du monorepo
pnpm docker:up                 # Lance PostgreSQL + Redis dans Docker
pnpm db:migrate                # Cree les tables dans PostgreSQL
pnpm db:seed                   # Insere des donnees de test
pnpm dev                       # Tout demarre
```

C'est pret. Pas d'installation de PostgreSQL locale, pas de "chez moi ca marche pas".

### Scripts disponibles

```bash
pnpm dev                 # Lance tout (API + web + mobile)
pnpm dev --filter api    # Lance seulement l'API
pnpm dev --filter web    # Lance seulement le web
pnpm build               # Build de production
pnpm lint                # Verifie le code (ESLint + Prettier)
pnpm test                # Lance les tests
pnpm docker:up           # Demarre PostgreSQL + Redis
pnpm docker:down         # Arrete PostgreSQL + Redis
pnpm db:generate         # Genere une migration apres changement de schema
pnpm db:migrate          # Applique les migrations
pnpm db:seed             # Insere les donnees de test
pnpm db:studio           # Ouvre une interface web pour voir la BDD
```

### Variables d'environnement

Le fichier `.env.example` est dans Git (on le voit tous les deux) avec des valeurs par defaut qui marchent en local :

```env
# Base de donnees (correspond au docker-compose)
DATABASE_URL=postgresql://nextquest:nextquest@localhost:5432/nextquest

# Redis (correspond au docker-compose)
REDIS_URL=redis://localhost:6379

# JWT -- secrets pour signer les tokens d'authentification
JWT_SECRET=dev-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production

# API
PORT=3000
NODE_ENV=development
```

Le vrai `.env` (copie de `.env.example`) est dans `.gitignore` -- il ne sera jamais commite. En production, ces valeurs seront differentes et secretes.

---

## 6. Workflow d'equipe -- Git, PR, CI/CD

### Branches

```
main              Production, protegee, personne ne push directement
  |
  └── develop     Integration, branche par defaut pour le dev
        |
        ├── feature/auth-jwt           [JB]
        ├── feature/game-collection    [JB]
        ├── feature/dashboard-ui       [Lorelei]
        ├── feature/game-card          [Lorelei]
        └── fix/login-redirect         [n'importe qui]
```

**Ce qu'on connait :** Git basique (commit, push, pull, branches). En DWWM on travaillait probablement sur `main` directement ou avec des branches simples.

**Ce qu'on fait en plus :**
- `main` et `develop` sont **protegees** -- impossible de push directement dessus. Tout passe par une Pull Request (PR).
- Chaque feature = une branche. Convention de nommage : `feature/nom-court`, `fix/nom-du-bug`.
- Quand c'est pret, on ouvre une PR vers `develop`. L'autre personne relit le code, fait des commentaires, puis approuve.
- Quand `develop` est stable et qu'on veut deployer, on fait une PR `develop -> main`.

### Pull Requests et code review

**Pourquoi c'est important :**
- Ca nous force a relire le code de l'autre -- je comprends le front, Lorelei comprend le back.
- Ca attrape les bugs avant qu'ils arrivent sur `develop`.
- Le jury CDA verra un historique Git professionnel avec des reviews, des discussions, des branches propres.

**En pratique :** Quand Lorelei a fini une feature, elle ouvre une PR sur GitHub. Je recois une notification, je relis le code, je laisse des commentaires. Elle corrige si besoin, puis j'approuve et merge. Et inversement.

### CI/CD -- GitHub Actions

**Ce qu'on connait :** DevOps au programme CDA (35H -- Docker, CI/CD).

**Ce qu'on fait :** A chaque PR, GitHub lance automatiquement :

1. **Lint** -- Verifie que le code respecte les regles ESLint + Prettier
2. **Type check** -- Verifie qu'il n'y a pas d'erreurs TypeScript
3. **Tests** -- Lance tous les tests unitaires et d'integration
4. **Build** -- Verifie que le projet compile

Si un de ces checks echoue, la PR ne peut pas etre mergee. Ca evite de casser `develop`.

### Conventional Commits

Les messages de commit suivent une convention pour etre lisibles dans l'historique :

```
feat: ajouter la page de collection de jeux
fix: corriger le crash au login quand l'email est vide
docs: documenter les endpoints de l'API games
refactor: extraire la logique de validation dans un service
test: ajouter les tests du service d'authentification
```

Le prefixe (`feat`, `fix`, `docs`, etc.) dit immediatement de quoi il s'agit sans lire le detail.

---

## 7. Securite -- OWASP et bonnes pratiques

Le programme CDA a 35H de securite et le bloc 1 demande de "developper une application securisee". Voici comment chaque mesure repond a une menace reelle.

### Top 10 OWASP et nos reponses

**Injection SQL**
- Risque : un utilisateur tape `'; DROP TABLE users; --` dans un champ
- Notre reponse : Drizzle utilise des requetes parametrees. Impossible d'injecter du SQL.

**Broken Authentication**
- Risque : quelqu'un vole un token ou brute-force un mot de passe
- Notre reponse : JWT access (15 min) + refresh (7 jours, en BDD, revocable). Rate limiting sur le login.

**Sensitive Data Exposure**
- Risque : mots de passe en clair en BDD, tokens dans les logs
- Notre reponse : hachage bcrypt/argon2 pour les passwords. Tokens chiffres. Variables d'env pour les secrets.

**XSS (Cross-Site Scripting)**
- Risque : un utilisateur injecte du `<script>` dans son pseudo
- Notre reponse : validation Zod stricte sur toutes les entrees. Helmet pour les headers de securite.

**Broken Access Control**
- Risque : un utilisateur accede aux donnees d'un autre
- Notre reponse : verification d'autorisation dans chaque controller. Tests d'acces dans la CI.

**Security Misconfiguration**
- Risque : CORS ouvert a tout le monde, headers manquants
- Notre reponse : `@fastify/cors` configure explicitement. `@fastify/helmet` ajoute les headers de securite.

**CSRF (Cross-Site Request Forgery)**
- Risque : un site malveillant fait des requetes au nom de l'utilisateur
- Notre reponse : API stateless (JWT), pas de cookies de session. Les tokens sont dans le header `Authorization`.

### Authentification detaillee

```
Login (email + password)
    |
    v
Verification bcrypt/argon2 du password
    |
    v
Generation de 2 tokens :
    - Access token JWT (15 min, signe, dans le header Authorization)
    - Refresh token (7 jours, stocke en BDD + envoye au client)
    |
    v
Quand l'access token expire :
    - Le client envoie le refresh token
    - L'API verifie qu'il existe en BDD et n'est pas expire
    - Genere un nouveau couple access + refresh
    - L'ancien refresh token est supprime (rotation)
```

**Pourquoi 2 tokens ?** L'access token est court (15 min) pour limiter les degats si quelqu'un le vole. Le refresh token est long (7 jours) pour ne pas obliger l'utilisateur a se reconnecter toutes les 15 minutes. Et comme le refresh token est en BDD, on peut le revoquer (deconnecter quelqu'un a distance).

### RGPD

NextQuest collecte des donnees personnelles (email, pseudo, collection de jeux). La RGPD impose :
- **Droit de suppression :** Un endpoint `DELETE /api/users/me` qui supprime le compte et toutes les donnees associees
- **Droit d'export :** Un endpoint `GET /api/users/me/export` qui renvoie toutes les donnees au format JSON
- **Consentement :** L'utilisateur accepte les conditions avant de creer son compte
- **Minimisation :** On ne collecte que ce qui est necessaire

---

## 8. Deploiement

### Environnements

**Local** (developpement quotidien)
- BDD : Docker Compose (PostgreSQL + Redis)
- API : `pnpm dev:api` sur localhost:3000
- Web : `pnpm dev:web` sur localhost:3001

**Preview** (chaque Pull Request)
- BDD : base de staging partagee
- API + Web : auto-deploy, URL de preview Vercel par PR

**Production** (merge sur `main`)
- BDD : PostgreSQL manage (Neon ou Railway)
- API : Railway ou Render
- Web : Vercel

### Services de deploiement

**Web -- Vercel** (gratuit, tier hobby)
Deploiement automatique sur push, preview par PR, optimise pour Next.js et Nuxt.

**API -- Railway ou Render** (gratuit, tier hobby)
Containers Node.js, simple a configurer, logs integres.

**PostgreSQL -- Neon ou Railway** (gratuit, tier hobby)
PostgreSQL manage avec backups automatiques.

**Redis -- Upstash** (gratuit, 10k requetes/jour)
Redis serverless, pay-per-use. Largement suffisant pour le dev et le MVP.

**Mobile -- Expo EAS** (gratuit, 30 builds/mois)
Build iOS/Android dans le cloud, distribution TestFlight + Play Store.

Pour un projet CDA, les tiers gratuits suffisent largement.

---

## 9. Le choix frontend -- React vs Vue (a decider ensemble)

Ce choix impacte principalement Lorelei (frontend) mais aussi moi (interventions frontend occasionnelles). Le backend, les packages partages, Docker, la CI -- tout ca reste identique quel que soit le choix.

### Option A : React (Next.js pour le web + Expo pour le mobile)

**Arguments pour :**
- React Native est au programme CDA annee 2 (35H). Connaitre React pour le web = avance sur le mobile.
- Partage de code reel entre web et mobile (hooks, composants, logique).
- Ecosysteme le plus large (communaute, packages, ressources).
- Je connais React, je peux aider sur le frontend.
- React + React Native sur le CV = gros avantage professionnel.

**Arguments contre :**
- Lorelei doit apprendre React (transition depuis Vue, estimee a 1-2 semaines).
- JSX au lieu de `<template>` -- paradigme different.

**Transition Vue -> React :** La logique est tres similaire.
```
// Vue 3 Composition API        // React hooks
const count = ref(0)             const [count, setCount] = useState(0)
const double = computed(() =>    const double = useMemo(() =>
  count.value * 2)                 count * 2, [count])
watch(count, (val) => {})        useEffect(() => {}, [count])
onMounted(() => {})              useEffect(() => {}, [])
```

### Option B : Vue (Nuxt pour le web) + React Native (Expo pour le mobile)

**Arguments pour :**
- Lorelei est immediatement productive (Vue appris en CDA, 56H).
- Nuxt est un excellent framework, bien maintenu.
- J'apprends Vue = competence supplementaire.

**Arguments contre :**
- Deux ecosystemes frontend a gerer (Vue pour le web, React pour le mobile).
- Zero partage de composants entre web et mobile.
- Le mobile React Native en annee 2 sera une decouverte complete pour Lorelei.
- Lorelei devra maitriser deux frameworks au lieu d'un.

### Rappel sur Quasar

Quasar permet d'utiliser Vue pour le web ET le mobile (via Capacitor). Mais le mobile Capacitor = WebView (site web emballe), pas une app native. La difference de qualite est perceptible par l'utilisateur, et le jury CDA pourrait le remarquer.

### Synthese

**Productivite immediate de Lorelei**
- React : moindre (1-2 semaines de transition)
- Vue : maximale, c'est ce qu'on connait

**Partage de code entre web et mobile**
- React : eleve (hooks, composants, logique reutilisables)
- Vue : faible (Vue web et React Native mobile = zero partage)

**Nombre de frameworks a maitriser**
- React : un seul (React pour le web et le mobile)
- Vue : deux (Vue pour le web, React pour le mobile)

**Preparation a l'annee 2 du CDA**
- React : React Native sera deja connu, on arrive avec de l'avance
- Vue : React Native sera une decouverte complete en cours

**CV et emploi**
- React : #1 en offres d'emploi en France
- Vue : bien present mais environ 3x moins d'offres

**Ma recommandation : React (Next.js + Expo).** Mais les deux options sont viables -- le plus important c'est qu'on soit a l'aise et productifs ensemble.

---

## Recapitulatif final

**Decide :**
- Runtime : Node.js 22 LTS
- Langage : TypeScript strict
- API : Fastify 5
- ORM : Drizzle
- BDD : PostgreSQL 16
- Cache : Redis 7
- Validation : Zod
- Tests : Vitest + Supertest
- Linting : ESLint 9 + Prettier
- Monorepo : pnpm + Turborepo
- CI/CD : GitHub Actions
- Containers : Docker Compose
- Doc API : Swagger auto-genere
- Mobile : Expo (React Native)
- Auth : JWT (access + refresh)

**Decide (31 mars) :**
- Frontend web : Nuxt 3 (Vue.js) + Tailwind CSS
