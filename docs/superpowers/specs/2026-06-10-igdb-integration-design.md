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
   lancée en fire-and-forget après un import (`void enrichGames(...)`) et
   ré-exécutable manuellement via un endpoint admin. Pas de file de jobs au MVP
   (pas d'infra queue, YAGNI).

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
├── igdb.routes.ts    # POST /api/games/enrich (admin/manuel)
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
- `enrichGames(options?)` : orchestration de la pass.
  1. `SELECT` des jeux à enrichir : `igdb_id IS NULL OR last_synced_at < now() - N`.
  2. Mapping appid → igdbId via le client pour ceux qui ont un `steam_appid` sans
     `igdb_id`.
  3. Fetch des métadonnées en batch.
  4. Upsert transactionnel (voir flux ci-dessous).
- Renvoie un résumé (`{ scanned, mapped, enriched, notFound, failed }`) pour le log et
  la réponse de l'endpoint.

### `igdb.routes.ts`
- `POST /api/games/enrich` : déclenche une pass manuelle. Protégé (réservé à un usage
  admin/dev au MVP). Renvoie le résumé.
- Le hook fire-and-forget après import Steam appelle directement `enrichGames()` côté
  service, sans passer par la route HTTP.

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

## Hors scope #55 (post-MVP)

- Keywords IGDB (volumineux, bruités), `player_perspectives`, RAWG, embeddings
  sémantiques.
- Peuplement de `game_updates` (détection de changements pour notifications) — les
  notifs ne sont pas dans le MVP.
- File de jobs / scheduler dédié pour l'enrichissement (fire-and-forget + endpoint
  manuel suffisent au MVP).

## Risques

- **Code Steam `external_games`** : à confirmer empiriquement (cf. plus haut).
- **Couverture IGDB** : certains jeux Steam (très récents, niche, démos) peuvent ne
  pas avoir de correspondance IGDB → gérés comme « introuvable ».
- **Volume** : une grosse biblio (centaines de jeux) implique plusieurs requêtes
  batch sous rate limit ; la pass étant découplée et asynchrone, ce n'est pas un
  problème de latence côté user.
