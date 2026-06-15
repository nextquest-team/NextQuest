# Spec — Intégration IGDB (lot MVP #55)

Date : 2026-06-10
Auteur : Jean-Baptiste
Issue : [#55](https://github.com/nextquest-team/NextQuest/issues/55)
Branche : `feature/igdb`

## Objectif

Enrichir notre catalogue `games` avec les métadonnées IGDB : titre, résumé, jaquette,
arrière-plan, date de sortie, développeur/éditeur, genres, thèmes, note joueurs et
jeux similaires. Ces données alimentent la fiche jeu (#56) et la reco (#58).

IGDB n'est **jamais interrogé en live** côté lecture : on hydrate notre table `games`
une fois, puis on lit chez nous. La table `games` est un **catalogue global partagé**
(une ligne par jeu, pas par user), donc une fois un jeu enrichi il l'est pour tout le
monde — c'est le cache.

## Décisions de design

1. **Déclenchement découplé de l'import.** L'enrichissement n'est pas dans la
   transaction d'import Steam (qui doit rester < 3s). Il tourne en pass séparée,
   lancée en fire-and-forget après un import (`void enrichGames({ userId })`) et
   ré-exécutable manuellement via un endpoint **scopé à la bibliothèque du user
   appelant** (pas d'opération globale au MVP, cf. décision 6). Pas de file de jobs
   au MVP (pas d'infra queue, YAGNI). Le fire-and-forget tient parce que l'API est un
   process long-running (container Docker), pas du serverless. La pass étant
   idempotente, un crash en cours est sans conséquence : les jeux `igdb_id IS NULL`
   sont rattrapés à la passe suivante. Upgrade vers une vraie queue (BullMQ/Redis)
   suivi en post-MVP (issue #68).

6. **Rôle admin pris en charge dès #55.** Le schéma a déjà la colonne `users.role`
   (`userRoleEnum ['user','admin']`, défaut `user`) et le JWT d'accès porte déjà
   `role` dans son payload (signé `{ sub, role }` dans auth/oauth). On ajoute donc :
   - un middleware `requireAdmin` (après `requireAuth` : vérifie
     `request.user.role === 'admin'`, sinon 403, sans lookup BDD) ;
   - un endpoint **admin global** `POST /api/admin/games/enrich` qui enrichit /
     re-synchronise tout le catalogue (jeux `igdb_id IS NULL` ou périmés), pour
     l'exploitation.
   On garde en plus un endpoint **self-service** `POST /api/users/me/library/enrich`
   (tout user authentifié, scopé à sa propre bibliothèque) pour rafraîchir ses
   métadonnées sans risque. Les deux réutilisent le même service `enrichGames`
   (variante scopée par `userId` vs variante globale). La pass reste idempotente +
   throttlée.

2. **Catalogue partagé = cache.** La pass ne sélectionne que les jeux jamais
   hydratés (`igdb_id IS NULL`) ou périmés (`last_synced_at` ancien). Si user A a
   déjà fait hydrater « Hades », user B qui le possède pointe sur la même ligne déjà
   enrichie : zéro appel IGDB. `last_synced_at` est le garde-fou de fraîcheur.

3. **Thèmes dans `tags` avec `category = 'theme'`.** La table `tags` a déjà un champ
   `category` fait pour ça : pas de table quasi-jumelle des genres. On ajoute une
   colonne `igdb_id` (nullable) à `tags` pour dédupliquer par id IGDB plutôt que par
   slug, et on dédup sur `(category, igdb_id)`. Justification : si on importe plus
   tard les keywords IGDB, deux entrées pourraient partager un slug
   (« horror » thème vs « horror » keyword) et casser la contrainte `slug unique`.
   Les genres gardent leur table dédiée (déjà en place, déjà avec `igdb_id`).

4. **`similar_games` en ids IGDB bruts.** Table `game_similar(game_id → games.id,
   similar_igdb_id integer)`. IGDB renvoie des ids de jeux dont la plupart ne sont
   pas dans notre `games` (on n'a que les biblios des users). Stocker l'id brut ne
   perd jamais le lien et n'exige pas que le jeu similaire soit déjà hydraté. La
   reco (#58) les résout et hydrate les candidats au moment voulu.

5. **Note joueurs = `rating` IGDB uniquement.** On mappe `rating` / `rating_count`
   d'IGDB (note des utilisateurs IGDB) vers `igdb_rating` / `igdb_rating_count`. On
   ignore `total_rating` (qui mélange la presse). Conforme à la décision roadmap.

## Faits IGDB confirmés (via doc officielle, context7)

- **Auth Twitch** : `POST https://id.twitch.tv/oauth2/token?client_id=...&client_secret=...&grant_type=client_credentials`
  → `{ access_token, expires_in, token_type }`. `expires_in` ≈ 64 jours.
  Toute requête IGDB porte les en-têtes `Client-ID: <client_id>` et
  `Authorization: Bearer <access_token>`.
- **Endpoints** : `POST https://api.igdb.com/v4/external_games` et
  `POST https://api.igdb.com/v4/games`. Corps = requête Apicalypse
  (`fields ...; where ...; limit ...;`).
- **Rate limit** : 4 req/s (429 au-delà), max 8 requêtes ouvertes simultanées.
- **Pagination/batch** : `limit` défaut 10, max 500 ; `offset` pour paginer.
  Filtre `where id = (1,2,3);` pour récupérer plusieurs jeux d'un coup.
- **Champs `games`** utiles : `name, summary, first_release_date (unix),
  cover.image_id, artworks.image_id, involved_companies.company.name,
  involved_companies.developer, involved_companies.publisher, genres.name,
  genres.slug, themes.name, themes.slug, rating, rating_count, similar_games`.
- **Image** : l'URL se construit depuis `image_id` :
  `https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg`
  (jaquette) et un format type `t_screenshot_huge` / `t_1080p` pour l'arrière-plan.

### Point à vérifier empiriquement à l'implémentation

Le **code Steam dans `external_games`** : IGDB migre du champ `category` (Steam = `1`
historiquement) vers `external_game_source`. On confirmera la bonne valeur en
testant contre un appid connu (ex. Hades = `1145360`) avant de figer la constante,
au lieu de hardcoder un nombre tiré de la doc.

## Architecture

Nouveau module `apps/api/src/modules/games/igdb/`, calqué sur le pattern du module
Steam (fonctions pures, `fetchImpl` injectable pour les tests, base URL via `.env`) :

```
apps/api/src/modules/games/igdb/
├── igdb.auth.ts      # token Twitch, cache Redis, refresh paresseux
├── igdb.client.ts    # requêtes Apicalypse, fonctions pures, fetchImpl injectable
├── igdb.service.ts   # orchestration : sélection → mapping → fetch → upsert
├── igdb.routes.ts    # POST /api/users/me/library/enrich + /api/admin/games/enrich
└── __tests__/        # unitaires (auth, client, mapping) + intégration (service/routes)
```

### `igdb.auth.ts`
- `getAccessToken()` : lit le token en cache Redis ; si absent/expiré, appelle Twitch,
  stocke en Redis avec TTL = `expires_in` (avec marge de sécurité, ex. -1 jour).
- Sur `401` d'une requête IGDB : invalide le cache et retente une fois.

### `igdb.client.ts`
Fonctions pures, chacune fait UN appel et renvoie des données typées (Zod en sortie) :
- `findGameIdsBySteamAppids(appids, token, fetchImpl)` → `Map<appid, igdbId>`
  (requête `external_games`, batch par `uid`).
- `fetchGamesByIds(igdbIds, token, fetchImpl)` → `IgdbGame[]`
  (requête `games`, batch par `where id = (...)`, `limit 500`).
- Respect du rate limit : helper de throttling (≤ 4 req/s, ≤ 8 en vol) appliqué aux
  appels en lot. Sur `429` → backoff + retry.
- Distinction des erreurs comme le client Steam : « jeu introuvable » (absent du
  résultat, pas une erreur) vs « IGDB en panne » (HTTP non-200 → on lève).

### `igdb.service.ts`
- `enrichGames({ userId })` : orchestration de la pass, **scopée à un user**.
  1. `SELECT` des jeux à enrichir parmi la bibliothèque du user (`user_games` →
     `games`) : `igdb_id IS NULL OR last_synced_at < now() - N`.
  2. Mapping appid → igdbId via le client pour ceux qui ont un `steam_appid` sans
     `igdb_id`.
  3. Fetch des métadonnées en batch.
  4. Upsert transactionnel (voir flux ci-dessous). L'upsert reste global au catalogue
     partagé : enrichir un jeu profite à tous les users qui le possèdent.
- Renvoie un résumé (`{ scanned, mapped, enriched, notFound, failed }`) pour le log et
  la réponse de l'endpoint.
- `enrichGames()` sans `userId` = **variante globale** (tout le catalogue, jeux
  `igdb_id IS NULL` ou périmés), utilisée par l'endpoint admin.

### `igdb.routes.ts` + guard admin
- `POST /api/users/me/library/enrich` : pass manuelle **scopée à la bibliothèque de
  l'appelant**. `requireAuth`, throttlé. Renvoie le résumé. Tout user authentifié,
  pas de rôle admin requis (opération bornée à ses données).
- `POST /api/admin/games/enrich` : pass **globale** sur tout le catalogue.
  `requireAuth` + `requireAdmin`, throttlé. Réservé à l'exploitation.
- `requireAdmin` : guard partagé dans `apps/api/src/lib/guards.ts`. S'exécute après
  `requireAuth`, lit `request.user.role` (déjà dans le JWT) et renvoie 403 si
  ≠ `'admin'`. Réutilisable par la future modération.
- Le hook fire-and-forget après import Steam appelle directement
  `enrichGames({ userId })` côté service, sans passer par la route HTTP.

## Flux d'enrichissement

1. Sélection des jeux candidats (jamais hydratés ou périmés).
2. Pour ceux à `steam_appid` sans `igdb_id` : `external_games` → résolution de
   l'`igdb_id`. Si introuvable, on marque `last_synced_at = now()` et `igdb_id` reste
   `NULL` (évite de re-tenter en boucle un jeu absent d'IGDB).
3. Fetch des `games` IGDB en batch.
4. **Upsert transactionnel** (tout-ou-rien par lot) :
   - `games` : `igdb_id, summary→description, cover_url, background_url, release_date,
     developer, publisher, igdb_rating, igdb_rating_count, last_synced_at = now()`.
   - `genres` + `game_genres` : upsert des genres (dédup par `igdb_id`) puis liaison.
   - `tags` (category='theme') + `game_tags` : idem pour les thèmes.
   - `game_similar` : remplace les lignes du jeu par les `similar_igdb_id` reçus.
5. Throttling global pour rester sous 4 req/s.

## Schéma BDD (migration Drizzle)

Fichiers : `packages/db/src/schema/games.ts`, `packages/db/src/schema/services.ts`,
nouvelle migration, et `docs/database/schema.dbml` à jour.

- **`games`** : ajout
  - `igdb_rating numeric` — note joueurs IGDB (0–100).
  - `igdb_rating_count integer` — nombre de votes (seuil exploité côté reco #58).
- **`tags`** : ajout `igdb_id integer` (nullable). Dédup applicative sur
  `(category, igdb_id)`.
- **Nouvelle table `game_similar`** :
  - `game_id uuid NOT NULL → games.id ON DELETE CASCADE`
  - `similar_igdb_id integer NOT NULL`
  - PK composite `(game_id, similar_igdb_id)`
  - Index sur `similar_igdb_id` (la reco filtrera par cet id).
  - ON DELETE CASCADE cohérent avec la règle RGPD (suppression d'un jeu purge ses
    liens) — ici pas de FK vers `users` donc pas de donnée personnelle.

Doc DBML : rôle de `game_similar`, justification des index, comportement ON DELETE,
note sur le stockage en id IGDB brut (et non FK résolue).

## Auth & configuration

`.env.example` (placeholders, valeurs réelles en `.env` gitignoré) :
```
# IGDB — via Twitch (https://dev.twitch.tv/console/apps)
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
# Optionnel, défaut en dur (URLs officielles) :
IGDB_API_BASE=https://api.igdb.com/v4
TWITCH_TOKEN_URL=https://id.twitch.tv/oauth2/token
```

## Robustesse & gestion d'erreurs

- **IGDB en panne** (HTTP non-200, hors 429) → on lève ; la pass échoue proprement et
  sera relancée plus tard. On ne marque pas `last_synced_at` pour ces jeux.
- **Jeu introuvable sur IGDB** → on marque `last_synced_at = now()`, `igdb_id` reste
  `NULL` : on ne le re-tente pas à chaque pass.
- **429** → backoff exponentiel court + retry (borné).
- **401** → refresh du token Twitch + retry une fois.
- La pass est idempotente : la relancer ne crée pas de doublon (upserts + dédup).

## Tests

- **Unitaires** (`fetchImpl` mocké) : `igdb.auth` (cache hit/miss, refresh sur 401),
  `igdb.client` (parsing Apicalypse, batch, distinction panne/introuvable, 429),
  mapping appid → igdbId, construction des URLs d'image.
- **Intégration** (vraie BDD distante) : `enrichGames` upsert correctement
  `games` / `genres` / `game_genres` / `tags` / `game_tags` / `game_similar` ;
  idempotence (relancer ne duplique pas) ; un jeu introuvable marque `last_synced_at`
  sans casser le lot.
- Validation end-to-end manuelle contre l'API IGDB réelle sur quelques appids connus
  (dont la confirmation du code Steam de `external_games`).

## Hors scope #55 — suivi post-MVP (issues)

Les raccourcis assumés pour tenir le MVP, tracés en issues GitHub pour l'appli finale :

- **#68** — Remplacer le fire-and-forget par une vraie queue de jobs (BullMQ/Redis).
- ~~#69 — Rôles admin + endpoint d'enrichissement global~~ : **fait dans #55** (la
  colonne `users.role` et le claim JWT existaient déjà ; on ajoute `requireAdmin` +
  l'endpoint admin global). Issue fermée.
- **#70** — Re-sync planifié des métadonnées IGDB (scheduler).
- **#71** — Détection de changements IGDB → `game_updates` + notifications.
- **#72** — Enrichir le catalogue avec keywords IGDB + `player_perspectives`.

Déjà documentés dans la roadmap (`docs/roadmap-mvp.md`, section « Hors MVP »), non
re-créés en issues ici : RAWG en complément, embeddings sémantiques (pgvector) comme
2e signal de scoring reco.

## Risques

- **Code Steam `external_games`** : à confirmer empiriquement (cf. plus haut).
- **Couverture IGDB** : certains jeux Steam (très récents, niche, démos) peuvent ne
  pas avoir de correspondance IGDB → gérés comme « introuvable ».
- **Volume** : une grosse biblio (centaines de jeux) implique plusieurs requêtes
  batch sous rate limit ; la pass étant découplée et asynchrone, ce n'est pas un
  problème de latence côté user.
