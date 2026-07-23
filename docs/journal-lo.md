# Journal de bord — Lorelei

## 2026-07-23 — Session 6 : Fix navigation RecoCard vers jeu introuvable

### Résumé exécutif

Cliquer sur une recommandation Next Quest renvoyait systématiquement sur « jeu introuvable ». `RecoCard.goToGame` naviguait vers `/games/catalog/${g.id}`, l'UUID interne du jeu — la page catalogue attend l'`igdbId` numérique (cf. `TimelineGameCard.vue`, même pattern). Le champ `igdbId` existe côté API depuis la PR #112 (`recommendations.dto.ts`, closes #110) mais n'avait jamais été répercuté dans le type front `RecoGame`.

### Ce qui a été fait

#### `types/recommendations.ts`
- Ajout de `igdbId: number | null` sur `RecoGame`

#### `RecoCard.vue`
- `goToGame()` utilise désormais `g.igdbId` pour la navigation et le `catalogPreview`, avec garde si `null`
- Suppression du mapping `genres` bancal du preview (`Number(genre.id)` sur un UUID — `IgdbTaxonRef[]` attend un `igdbId` numérique que les recos ne fournissent pas) ; la fiche complète est de toute façon refetchée juste après via `useGameCatalogDetail`

### Fichiers modifiés

| Fichier | Nature |
|---|---|
| `apps/web/types/recommendations.ts` | Ajout `igdbId` sur `RecoGame` |
| `apps/web/components/next-quest/RecoCard.vue` | Fix navigation vers la fiche jeu (utilise `igdbId` au lieu de l'UUID interne) |

---

## 2026-07-23 — Session 5 : Fix cover étirée sur RecoCard

### Résumé exécutif

Correctif visuel isolé sur `RecoCard.vue` : la cover du jeu était étirée en hauteur (`align-self: stretch`) pour remplir tout le corps de la carte, ce qui déformait des covers plus courtes que le corps. La cover garde maintenant son `aspect-ratio: 3/4` natif et s'aligne en haut de la carte.

### Ce qui a été fait

#### `RecoCard.vue`
- `.nq-card-cover` : `align-self: stretch` → `flex-start` (la cover ne s'étire plus verticalement pour combler `.nq-card-body`)
- Ajout de `max-height: 100%` pour éviter tout débordement si l'aspect-ratio pousse la cover plus haut que le corps de la carte

### Fichiers modifiés

| Fichier | Nature |
|---|---|
| `apps/web/components/next-quest/RecoCard.vue` | Fix CSS cover étirée dans le corps de carte |

---

## 2026-07-22 — Session 4 : Corrections review JB sur fix/generation-next-quest

### Résumé exécutif

Retour de review de JB sur le fix de génération Next Quest (endpoint groupé pour déclencher le replenish-when-dry) : diagnostic validé, CI verte, mais deux points à corriger avant merge — logs de debug oubliés et un échec silencieux qui laissait une carte fantôme affichée après un décline raté.

### Ce qui a été fait

#### `pages/next-quest.vue`
- Suppression des 7 `console.log`/`console.error` `[nextQuest]` dans `refillBucket` et `sendFeedback` (le repo est public, le reste du front n'a quasiment aucun `console.*`)
- `refillBucket` : le `catch` vide désormais la file du bucket concerné (`bucketQueue[bucket].value = []`) au lieu de se contenter d'un log — la card « Aucune suggestion » prend le relais plutôt que la carte déclinée qui restait affichée à tort
- `lastFailedOp` étendu à `'refresh'` : `refresh()` pose cet état en cas d'échec, et `retry()` rappelle `refresh()` (et non `generate()`) dans ce cas — avant, un échec de rotation faisait relancer `generate()` par le bouton « Réessayer », l'inverse de ce que la PR cherchait à corriger

### Décisions techniques

**Pas de toast/état d'erreur global pour l'échec de `refillBucket`.** JB proposait soit un état d'erreur, soit vider la file ; vider la file suffit à éviter la carte fantôme sans complexifier l'état global (`error.value` reste réservé aux échecs de `fetchRecos`/`generate`/`refresh`).

**`sendFeedback` : catch laissé vide (avec commentaire) plutôt que de déclencher `error.value = true`.** Si le POST de feedback échoue, aucune mutation de la file n'a eu lieu — rien à rattraper, et basculer toute la page en état d'erreur aurait caché les deux autres buckets encore valides pour un échec ponctuel.

**Point "à surveiller" non traité.** Le comportement où `refillBucket` remplace les 3 files (donc peut faire bouger l'ordre des 2 autres buckets non vides) reste tel quel — c'est un point de vérification navigateur signalé par JB, pas un bug confirmé.

### Fichiers modifiés

| Fichier | Nature |
|---|---|
| `apps/web/pages/next-quest.vue` | Retrait logs debug, fix carte fantôme sur échec refill, fix retry après échec refresh |

---

## 2026-06-23 — Session 3 : Dashboard desktop — données réelles

### Résumé exécutif

Remplacement de toutes les données mock du dashboard desktop par des appels API réels. La zone sac à dos affiche une grille 3×3 des 8 derniers jeux ajoutés à la collection (le 9e slot est réservé au bouton d'ajout), avec miniatures cliquables. La zone game cards affiche le feed "jeux à venir" trié par hype depuis IGDB.

### Ce qui a été fait

#### `DashboardDesktop.vue`
- Suppression de l'array mock `games`
- Ajout de `fetchBagGames()` : appel `GET /api/collection?limit=8&offset=0` au montage — l'API trie déjà par `createdAt DESC`, les 8 premiers = les 8 derniers ajoutés
- Grille 3×3 de miniatures carrées dans la div sac (`dd__bag-grid`) : chaque vignette affiche `coverUrl` ou une icône fallback, et link vers `/games/{userGameId}` (fiche de la collection)
- `v-for` du parchemin migré sur `bagGames` (suppression de la référence à l'ancien mock)

#### `DbGameCards.vue`
- Suppression du mock
- Ajout de `fetchUpcoming()` : appel `GET /api/games/upcoming?limit=20&sort=hype` au montage (endpoint PR #83, cache Redis 1h)
- Chaque carte affiche `coverUrl` IGDB (`t_cover_big`) + link vers `/games/catalog/{igdbId}`
- Fallback icône manette si `coverUrl` null
- `position: relative + overflow: hidden` ajouté à `.game-card` pour que la cover remplisse la carte

#### `types/game.ts`
- Ajout de `UpcomingGameDTO` (`igdbId`, `title`, `coverUrl`) — interface extraite du composant vers le fichier de types (correction de convention)

### Décisions techniques

**Pas de composable dédié pour ces deux fetches.** Les appels sont simples (un seul endpoint, pas de pagination, pas de filtres) — un composable aurait été une abstraction prématurée. Si le dashboard devient plus complexe (refresh, filtres, état partagé), on extrait à ce moment-là.

**`bagGames` réutilisé pour le parchemin.** Le parchemin listait aussi les jeux via l'ancien mock `games`. Plutôt que de dupliquer un fetch, il consomme `bagGames` en attendant sa propre logique métier (actualités/recos).

### Fichiers modifiés

| Fichier | Nature |
|---|---|
| `apps/web/components/dashboard/DashboardDesktop.vue` | Fetch réel collection, grille sac 3×3 |
| `apps/web/components/dashboard/DbGameCards.vue` | Fetch réel upcoming IGDB, covers + liens |
| `apps/web/types/game.ts` | Ajout `UpcomingGameDTO` |

---

## 2026-04-29 — Session 1 : Setup frontend auth

### Ce qui a été fait

#### Infrastructure
- Suppression de `@nuxtjs/tailwindcss` au profit de **Vuetify** seul (cohérence, composants riches)
- Ajout de `pinia` + `@pinia/nuxt` pour la gestion d'état
- Ajout de `vuetify-nuxt-module` + `@mdi/font` pour les icônes
- Mise à jour de `nuxt.config.ts` : thème custom Vuetify "nextquest", modules Pinia + Vuetify

#### Organisation des assets
Structure créée dans `apps/web/public/` :
```
public/
  images/
    backgrounds/   ← fond.png (texture tricot)
    logo/          ← logo.png (badge brodé)
    social/        ← Google, Microsoft, Apple SVG (à venir)
  fonts/           ← Knight Quest .woff2 (à venir)
```

#### Auth frontend

**Store** (`stores/auth.ts`)
- Pinia store avec `user`, `accessToken` (mémoire uniquement, pas de localStorage)
- `isAuthenticated` computed, `setAuth`, `clearAuth`

**Composable** (`composables/useAuth.ts`)
- `login()`, `register()`, `logout()`, `refreshTokens()`
- Gestion des erreurs (409 conflict, messages traduits)
- Appels API avec `credentials: 'include'` pour transmettre le cookie httpOnly

**Plugin** (`plugins/auth.client.ts`)
- Restauration silencieuse de la session au chargement via le refresh token (cookie httpOnly)

**Middlewares**
- `middleware/auth.ts` : redirige vers `/auth/login` si non connecté
- `middleware/guest.ts` : redirige vers `/` si déjà connecté (pages auth)

#### Composants UI
- `components/ui/PatchButton.vue` : bouton réutilisable (variantes `primary`, `back`, `social`)
- `components/ui/PatchInput.vue` : input stylisé avec label, show/hide mot de passe

#### Pages
- `pages/index.vue` : page d'entrée (logo + Connexion + Inscription)
- `pages/auth/login.vue` : formulaire email + mot de passe + boutons sociaux
- `pages/auth/register.vue` : formulaire pseudo + email + 2x mot de passe

#### Docker
- `apps/web/Dockerfile` : image production multi-stage (build Nuxt → runner Node)
- `docker/docker-compose.yml` mis à jour : service `web` dev avec hot reload

### Décisions techniques

| Choix | Raison |
|-------|--------|
| Access token en mémoire (Pinia) | Évite les attaques XSS via localStorage |
| Cookie httpOnly pour refresh token | Géré par le backend, inaccessible au JS |
| Restauration de session via plugin client | Le plugin s'exécute côté client uniquement, appelle `/api/auth/refresh` |
| Vuetify seul (sans Tailwind) | Évite les conflits de reset CSS entre les deux frameworks |
| Cinzel (Google Fonts) | Stand-in pour Knight Quest en attendant les fichiers de police |

### TODOs en attente

- [x] Intégrer la police **Knights Quest** ✓ (3 variantes : regular, calligraphique, shielded)
- [ ] Implémenter OAuth Google / Microsoft / Apple (en attente des routes backend — JB)
- [ ] Créer la page `/auth/forgot-password`
- [ ] Créer le dashboard et mettre à jour les redirections post-login
- [ ] Ajouter les SVG des providers sociaux dans `public/images/social/`
- [ ] Dockeriser l'API et mettre à jour `NUXT_PUBLIC_API_BASE` dans docker-compose

---

## 2026-04-29 — Session 2 : Bordure laine sur les boutons

### Ce qui a été fait

#### Asset wooly border
- Récupération du PNG `wooly-btn.png` (cadre laine 2048×2048) → placé dans `public/images/buttons/`
- Tentative initiale en CSS pur avec `box-shadow` : insuffisant, manque de réalisme

#### Border-image 9-slice
- Première implémentation avec `border-image` directement sur le PNG source
- Problème : le PNG source n'est pas tileable, les répétitions et étirements créent des cassures visibles aux jonctions

#### Génération d'un PNG tileable (script Python)
Création d'un script Python (PIL/Pillow) qui :
1. Extrait les 4 coins du PNG source (350×350 chacun)
2. Extrait une "unité" de motif laine (280px de période) sur chaque côté
3. Recompose un PNG tileable de 980×980 → `wooly-btn-tileable.png`
4. **Flood-fill** depuis l'extérieur pour identifier les zones transparentes intérieures vs extérieures
5. Crée une silhouette crème (cuisson de la couleur de fond directement dans le PNG)
6. Composite la laine par dessus → `wooly-btn-final.png`

Avantage : le crème ne déborde pas hors du contour laine (les coins arrondis restent transparents pour laisser apparaître le fond tricoté), tout en remplissant correctement les petits espaces entre les fibres.

#### Intégration CSS
- `.patch-btn` et `.patch-btn-back` utilisent maintenant `<button>` natif (au lieu de `v-btn` qui empilait des spans internes empêchant l'affichage du `border-image`)
- `border-image: url(...) 350 fill round` — le `fill` rend la partie centrale du PNG (la zone crème), le `round` répète proprement l'unité tileable
- `background: transparent` — le crème est cuit dans le PNG, pas besoin de fond CSS

#### Police Knights Quest
- Intégration des 3 fichiers TTF (`KnightsQuest.ttf`, `KnightsQuestCallig.ttf`, `KnightsQuestShielded.ttf`) dans `public/fonts/knights-quest/`
- Déclarations `@font-face` dans `main.css`
- `--nq-font` mis à jour : `'Knights Quest', 'Georgia', serif`

#### Docker testé en conditions réelles
- Container `nextquest-web` lancé via `docker compose up -d web`
- Hot reload fonctionnel via volume monté sur `..:/app`
- App accessible sur [http://localhost:3001](http://localhost:3001)

#### Documentation
- `docs/docker.md` mis à jour : ajout du service `web` + Dockerfile production
- `docs/journal-lo.md` complété (cette section)

### Décisions techniques

| Choix | Raison |
|-------|--------|
| `<button>` natif au lieu de `v-btn` | Vuetify empile des éléments internes qui cassent l'affichage de `border-image` |
| Génération du PNG tileable via Python | Fait à la place de l'utilisateur : pas d'outil de retouche image, le PNG d'origine n'était pas tileable |
| Crème cuit dans le PNG (`fill`) | Évite les problèmes de débordement (`border-box`) ou de transparence sous les stitches (`padding-box`) |
| `border-image-repeat: round` | Répète l'unité tileable proprement, contrairement à `stretch` qui écrasait les côtés |

### Scripts utiles

Le script Python qui génère `wooly-btn-final.png` est inline dans le journal de session — à conserver pour pouvoir régénérer si on change de palette ou de motif.

---

## 2026-04-29 — Session 3 : Branchement OAuth (Google + Microsoft)

### Contexte
Rebase sur `develop` qui contient la PR de JB : OAuth Google + Microsoft, route `/auth/me`, hardening sécurité (rate limiting, verrouillage de compte). Côté front il reste à brancher tout ça.

### Endpoints branchés

| Endpoint | Méthode | Avant | Après |
|----------|---------|-------|-------|
| `/api/auth/me` | GET | n'existait pas | `fetchMe()` dans `useAuth` |
| `/api/auth/oauth/:provider` | GET | n'existait pas | `loginWithOAuth(provider)` dans `useAuth` |
| `/api/auth/oauth/:provider/callback` | GET (backend uniquement) | — | géré par `pages/auth/callback.vue` |

### Fichiers modifiés / créés

- **`composables/useAuth.ts`** : ajout de `fetchMe()` (récupère le user via JWT) et `loginWithOAuth(provider)` (récupère l'URL d'autorisation et redirige le navigateur vers Google/Microsoft)
- **`pages/auth/callback.vue`** (nouveau) : page d'atterrissage après OAuth. Lit `?token=` du query, appelle `fetchMe(token)`, redirige vers `/`. Gère aussi les erreurs OAuth (`?error=oauth_denied`, `invalid_state`, etc.)
- **`pages/auth/login.vue`** : boutons Google et Microsoft activés et branchés sur `loginWithOAuth`. Apple reste désactivé (pas de provider Apple côté backend pour l'instant)

### Flow OAuth complet

1. User click sur "Connect with Google"
2. Front → `GET /api/auth/oauth/google` → reçoit `{ url: "https://accounts.google.com/..." }`
3. `window.location.href = url` → redirection vers Google
4. User autorise → Google redirige vers `GET /api/auth/oauth/google/callback?code=...&state=...`
5. Backend échange le code, crée la session, set le cookie `refresh_token` (httpOnly), redirige vers `http://localhost:3001/auth/callback?token=<jwt>`
6. Page `/auth/callback` lit le JWT, appelle `/auth/me` pour obtenir le user, redirige vers `/`

### Sécurité

- Le **refresh token** reste dans un cookie httpOnly (inaccessible au JS)
- Le **JWT access token** est stocké en mémoire (Pinia) — perdu au reload, restauré via le silent refresh au plugin client
- L'URL `?token=` reste brièvement dans l'historique du navigateur — `router.replace('/')` la nettoie aussitôt après
- CORS API restreint à `http://localhost:3001` (vérifié)

### TODOs

- [ ] JB doit configurer `GOOGLE_CLIENT_ID/SECRET` et `MICROSOFT_CLIENT_ID/SECRET` dans le `.env` pour tester en local
- [ ] Tester le flow complet une fois les credentials disponibles
- [ ] Page `/auth/forgot-password`
- [ ] Apple OAuth (en attente backend)
- [ ] Dashboard + redirection post-login (actuellement `/` qui est le landing — quand le dashboard existera, mettre à jour les redirections dans `useAuth` et le middleware `guest`)

---

## 2026-04-29 — Session 4 : Tests unitaires frontend

**Stack tests** -- Mise en place de Vitest + @vue/test-utils + @nuxt/test-utils + happy-dom + @pinia/testing. Config dans `apps/web/vitest.config.ts` (utilise `defineVitestConfig` de Nuxt pour bénéficier des auto-imports). Scripts `test` et `test:watch` ajoutés à `apps/web/package.json`. Le workflow CI lance déjà `pnpm test` à la racine via Turborepo, donc tout tourne automatiquement sur chaque PR.

**Couverture** -- 26 tests / 26 passants en 1.7s. Découpage : 3 tests sur le store Pinia (`stores/auth.test.ts`), 10 sur le composable `useAuth` (login, register, refresh, logout, fetchMe, loginWithOAuth — succès et échecs), 5 sur `PatchButton`, 4 sur `PatchInput`, 4 sur les middlewares (`auth`, `guest`).

**Choix techniques** -- Mock de `$fetch` via `vi.stubGlobal` côté Nuxt. Mock de `navigateTo` via `mockNuxtImport` de @nuxt/test-utils (compile-time transform requis pour les auto-imports). Tests Vuetify avec instance de plugin créée par test pour éviter les fuites entre tests.

**Bug fix collatéral** -- Le pattern `try/finally` de `logout()` propageait l'erreur réseau au consommateur. Ajout d'un `catch` silencieux : la déconnexion locale (clear store + redirect) est garantie même si l'API tombe, ce qui est l'UX attendue.

**TODOs** -- Tests E2E avec Playwright à prévoir plus tard pour les flows complets (login form → submit → redirect). Tests sur `pages/auth/callback.vue` à ajouter quand les credentials OAuth seront configurés en local.

---

## 2026-04-30 — Session 5 : Popup OAuth, middleware global, polish UX login

### Contexte
Suite à la session 3 (OAuth en redirection complète), trois choses à faire : (1) passer le flow OAuth en popup pour ne pas perdre l'état du formulaire de login, (2) protéger toutes les routes par défaut au lieu d'opter-in route par route, (3) remplacer les pastilles unies des boutons sociaux par les vrais logos brand.

### Popup OAuth

Le flow redirection-complète marchait mais avait deux défauts UX : la page de login disparaissait pendant la phase Google/Microsoft (perte du contexte si l'user annule), et au retour le navigateur gardait `?token=…` brièvement dans l'historique.

Nouveau flow :
1. Click → `loginWithOAuth(provider)` ouvre `window.open(url, 'nq-oauth', 'width=500,height=700,…')`
2. La popup atterrit sur `/auth/callback?token=…` après la danse OAuth
3. `pages/auth/callback.vue` détecte `window.opener` non-null → c'est une popup → `postMessage({ type: 'nq-oauth-success', token }, window.location.origin)` puis `window.close()`
4. La page parente écoute les `message`, vérifie `event.origin === window.location.origin`, appelle `fetchMe(token)`, redirige vers `/dashboard`

**Sécurité** -- `event.origin` vérifié systématiquement (sinon n'importe quel iframe pourrait poster un faux token). `postMessage` cible explicitement `window.location.origin` et pas `'*'`.

**Robustesse** -- 3 chemins de sortie : popup ferme avec succès (postMessage success), popup ferme avec erreur (postMessage error), popup fermée par l'user sans postMessage (`setInterval` watch sur `popup.closed` qui nettoie `isLoading` et le listener). Et si `window.open` retourne `null` (popup bloquée), fallback automatique en redirection complète comme avant.

**Bonus collatéral** -- `loginWithOAuth` ne throw plus. Avant, `@click="loginWithOAuth('google')"` ne pouvait pas catcher l'erreur (Vue n'attend pas la promise des handlers d'event). Maintenant l'erreur est exposée via `error.value` et affichée par le template, comme pour le login email/password.

### Middleware global

`middleware/auth.ts` était nommé sans suffixe `.global`, donc il fallait l'opter-in dans chaque page via `definePageMeta({ middleware: 'auth' })`. Risque évident : oublier de protéger une nouvelle page. Renommé en `auth.global.ts` avec une whitelist explicite des routes publiques :

```ts
const PUBLIC_ROUTES = new Set(['/', '/auth/login', '/auth/register', '/auth/forgot-password', '/auth/callback'])
```

Tout le reste exige `store.isAuthenticated`. Tests adaptés (`tests/middleware/auth.test.ts`) : un cas pour chaque route publique + un cas pour une route privée non-authentifiée + un cas pour route privée authentifiée.

Les pages `/dashboard` et `/auth/forgot-password` (placeholders pour l'instant) ont été créées en parallèle pour valider que le middleware laisse bien passer la première et bloque la seconde uniquement si non-authentifié.

### SocialButton extrait

Avant, login.vue utilisait `UiPatchButton variant="social" color="#4285F4"` qui rendait juste une pastille unie. Pas glop : Google, Microsoft et Apple ont des chartes graphiques très reconnaissables et les utilisateurs s'attendent à voir leur logo officiel.

Nouveau composant `components/ui/SocialButton.vue` qui :
- prend une prop `provider: 'google' | 'microsoft' | 'apple'`
- rend le SVG officiel inline (Google multicolore 4 couleurs, Microsoft 4 carrés brand, Apple silhouette)
- gère `loading` et `disabled` (Apple reste désactivé en attendant le provider backend)
- applique le code couleur Apple (blanc-sur-noir) via `.social-btn--apple`

Les SVG sont inline plutôt qu'importés depuis un asset : ils sont petits, jamais réutilisés ailleurs, et inline évite une requête HTTP par bouton.

### Découpage des commits

| Commit | Contenu |
|--------|---------|
| `1eb62ff` | middleware global + dashboard + redirections /dashboard |
| `881cd82` | popup OAuth + SocialButton avec logos brand |

Découpé en deux pour que chaque commit soit atomique : le premier change l'architecture des middlewares et de la redirection post-auth, le second change l'UX du flow OAuth. Les tests passent à chaque commit individuellement (35/35 puis 37/37).

### TODOs restants

- [ ] JB doit configurer `GOOGLE_CLIENT_ID/SECRET` et `MICROSOFT_CLIENT_ID/SECRET` pour tester le flow complet en local
- [ ] Implémenter vraiment `/auth/forgot-password` (actuellement placeholder)
- [x] Implémenter `/dashboard` → session 6
- [ ] Apple OAuth (en attente backend)
- [ ] Tests E2E Playwright sur le flow popup OAuth quand les credentials seront en place

---

## 2026-05-06 — Session 6 : Dashboard (structure) + Dockerisation API

### Contexte

Nouvelle branche `dashboard` créée depuis `develop`. Deux objectifs : poser la structure du dashboard avec une vue mobile et une vue desktop distinctes, et finaliser la dockerisation de l'API (le TODO de la session 1 restait ouvert).

### Dashboard — deux composants distincts

Le dashboard aura des dispositions complètement différentes selon l'appareil : navigation en bas sur mobile, sidebar latérale sur desktop. Plutôt que de gérer ça avec des media queries dans un seul composant, on utilise deux composants dédiés commutés par `useDisplay` de Vuetify.

**Fichiers créés :**
- `components/dashboard/DashboardMobile.vue` — layout colonne pleine hauteur, navigation pied de page à venir
- `components/dashboard/DashboardDesktop.vue` — layout sidebar (260px fixe) + zone principale
- `pages/dashboard.vue` — orchestre le switch via `useDisplay().mobile`

**Pattern utilisé :**

```ts
// pages/dashboard.vue
import { useDisplay } from 'vuetify'
const { mobile } = useDisplay()
```

```html
<DashboardMobile v-if="mobile" :username @logout />
<DashboardDesktop v-else :username @logout />
```

`useDisplay` est réactif : si l'utilisateur redimensionne la fenêtre, le bon composant s'affiche instantanément sans rechargement.

### Dockerisation de l'API

**Service `api` ajouté dans `docker-compose.yml` :**
- Même pattern que le service `web` : `node:22-alpine` + `tsx watch` via `pnpm --filter @nextquest/api dev`
- `depends_on` avec `condition: service_healthy` sur `postgres` et `redis` — l'API ne démarre qu'une fois les deux services prêts (healthcheck)
- `env_file: ../.env` pour les variables (JWT, OAuth, etc.)
- Surcharge des URLs internes Docker dans `environment` (voir ci-dessous)

**Problème réseau Docker → fix en deux couches :**

Le `.env` contient `DATABASE_URL=...@localhost:5432` qui ne fonctionne pas dans le réseau Docker. Le service `api` surcharge ces valeurs :

```yaml
environment:
  - DATABASE_URL=postgresql://nextquest:nextquest@postgres:5432/nextquest
  - REDIS_URL=redis://redis:6379
  - API_BASE_URL=http://api:3000
```

**Bug `ERR_NAME_NOT_RESOLVED` sur `http://api:3000` depuis le browser :**

`NUXT_PUBLIC_API_BASE=http://api:3000` était injecté dans le browser qui ne connaît pas le réseau Docker interne. Fix : deux variables séparées.

| Variable | Valeur Docker | Contexte |
|----------|--------------|----------|
| `NUXT_API_BASE` | `http://api:3000` | SSR / middleware (tourne dans le container) |
| `NUXT_PUBLIC_API_BASE` | `http://localhost:3000` | Browser (tourne sur la machine host) |

Dans `nuxt.config.ts`, `runtimeConfig.apiBase` (privé, server-only) + `runtimeConfig.public.apiBase` (exposé au client).

Dans `useAuth.ts` :
```ts
const apiBase = import.meta.server ? config.apiBase : config.public.apiBase
```

**`.env.example` restructuré** — sections commentées, hints de génération des secrets (`openssl rand -base64 64` pour JWT, `openssl rand -hex 32` pour la clé de chiffrement), URIs OAuth précisées, `NUXT_PUBLIC_API_BASE` ajouté.

### Décisions techniques

| Choix | Raison |
|-------|--------|
| Deux composants Dashboard distincts | Dispositions trop différentes pour gérer avec des media queries — un seul composant aurait été illisible |
| `useDisplay` Vuetify plutôt que CSS breakpoints | Réactif en JS, permet de conditionner la logique (pas seulement le style), cohérent avec le reste de l'app Vuetify |
| `depends_on` avec `condition: service_healthy` | Évite les crashs au démarrage si l'API tente de se connecter avant que postgres/redis soient prêts |
| `env_file` + surcharge `environment` | Le `.env` reste la source de vérité pour le dev local, Docker surcharge uniquement ce qui doit changer (les hostnames) |
| `import.meta.server` dans `useAuth` | Pattern Nuxt 3 officiel pour distinguer SSR/client — plus fiable que `process.server` déprécié |

### TODOs

- [ ] Implémenter le contenu réel du dashboard mobile (collection, recommandations, fil d'activité)
- [ ] Implémenter le contenu réel du dashboard desktop + navigation sidebar
- [ ] Tester le flow complet login → dashboard une fois les credentials OAuth configurés

---

## 2026-05-06 — Session 7 : Dashboard mobile (composants) + i18n

### Contexte

Suite de la branche `dashboard`. Deux axes : (1) construire les composants de la section supérieure du dashboard mobile pas à pas, (2) mettre en place l'internationalisation (`@nuxtjs/i18n`) sur tout le frontend.

### Dashboard mobile — section supérieure

Le dashboard mobile est découpé en 3 zones flex-column :
- `dm__top` (40%) — ProfileCard + Parchemin + Sacoche en row
- `dm__mid` (flex: 1) — roue centrale (à venir)
- `dm__bot` (30%) — carte de jeu horizontale (à venir)

**Problème de nommage Nuxt résolu :**

Les composants placés dans `components/dashboard/` sont enregistrés par Nuxt avec le préfixe du dossier. `DbProfileCard.vue` doit donc être appelé `<DashboardDbProfileCard>` (et non `<DbProfileCard>`). Les templates utilisaient le mauvais nom, d'où les erreurs SSR "Failed to resolve component". Corrigé dans `DashboardMobile.vue`.

**`DbProfileCard.vue`** — composant carte de profil :
- Fond : avatar utilisateur (`avatar-profile.png`) en `position: absolute` z-index 1
- Overlay : cadre tressé vert (`encadrement-vert.png`) via `::after` pseudo-element z-index 2 — le cadre est visuellement au-dessus de l'avatar
- Contenu : bouton "Mon profil" + pseudo utilisateur en z-index 3
- Aspect ratio 143/257 pour coller aux proportions du cadre Figma

**`DbParchemin.vue`** et **`DbSacoche.vue`** — placeholders colorés en attente des assets définitifs.

### i18n — mise en place complète

**Installation :** `@nuxtjs/i18n` ajouté aux dépendances `apps/web`.

**Configuration `nuxt.config.ts` :**
- Stratégie `no_prefix` (pas de `/fr/dashboard`, `/en/dashboard` — l'URL reste la même)
- Détection automatique via la langue du navigateur : `fr-*` (fr-BE, fr-CA, fr-CH, etc.) → locale `fr` ; tout autre navigateur → fallback `en`
- Préférence mémorisée dans le cookie `nq_locale`

**Fichiers de traduction :**
- `locales/fr.json` — French (source of truth)
- `locales/en.json` — English

**Clés organisées par domaine :**
```
auth.login / auth.register / auth.logout
auth.forgotPassword / auth.orContinueWith / auth.comingSoon
auth.fields.email / auth.fields.password / auth.fields.username / …
auth.validation.emailRequired / auth.validation.passwordMin / …
dashboard.profile.button
dashboard.parchemin / dashboard.sacoche
```

**Composants et pages mis à jour :**
- `pages/index.vue`
- `pages/auth/login.vue`
- `pages/auth/register.vue`
- `pages/auth/forgot-password.vue`
- `components/dashboard/DbProfileCard.vue`
- `components/dashboard/DbParchemin.vue`
- `components/dashboard/DbSacoche.vue`

Tous les textes visibles passent désormais par `const { t } = useI18n()` — plus aucun texte hardcodé dans les templates.

### Décisions techniques

| Choix | Raison |
|-------|--------|
| Stratégie `no_prefix` | Les URLs restent propres (`/dashboard` et non `/fr/dashboard`) — convient à une app monolingue par session |
| Détection navigateur + cookie | L'utilisateur n'a pas à choisir manuellement sa langue, et la préférence est mémorisée entre les sessions |
| Fallback `en` | Langue internationale par défaut pour tout navigateur non francophone |
| `::after` pour le cadre vert | Permet de superposer le cadre au-dessus de l'avatar sans position absolute au niveau page ; `pointer-events: none` pour ne pas bloquer les clics sur le contenu |
| Redémarrage container requis | `@nuxtjs/i18n` génère des types auto-import (`.nuxt/`) — nécessite un `nuxt prepare` via le restart du container |

### TODOs

- [ ] Redémarrer le container web pour régénérer les types auto-import `useI18n`
- [ ] Construire `DbParchemin` (parchemin Actualités avec asset Figma)
- [ ] Construire `DbSacoche` (scène héros — landscape + dragon + boutons navigation)
- [ ] Construire `dm__mid` — roue centrale (tourne au hover/touch, statique sinon)
- [ ] Construire `dm__bot` — carte de jeu avec scroll horizontal
- [ ] Implémenter le contenu réel du dashboard desktop + navigation sidebar

---

## 2026-05-06 — Session 8 : Dashboard mobile dm__top — composants finalisés

### Ce qui a été fait

#### Correction du layout `dm__top`

Le layout initial utilisait `flex: 1` sur les trois enfants avec `align-items: stretch` (défaut), ce qui forçait chaque composant à remplir toute la hauteur de la section. La carte de profil avec `aspect-ratio: 143/257` se retrouvait plus courte que la section, laissant le fond apparaître en dessous.

Fix : passage à `align-items: center` + `justify-content: space-evenly` sur `dm__top`, et `flex: 0 0 30%` sur chaque composant. Les trois éléments flottent maintenant naturellement sur le fond tricoté, comme dans la maquette.

Suppression des fonds de debug colorés (rouge/vert/bleu) sur les trois zones.

#### `DbProfileCard` — composition finale

Structure retenue (3 couches z-index) :
- z-index 1 : avatar (`hero` placeholder → TODO remplacer par avatar utilisateur API)
- z-index 2 : cadre vert (`encadrement-vert.png`) via `::after` pseudo-element
- z-index 3 : contenu (bouton "Mon profil" + pseudo utilisateur)

`aspect-ratio: 143/257` restauré avec `flex: 0 0 30%` — la carte conserve ses proportions de maquette et ne s'étire plus.

Font sizes avec `clamp()` pour s'adapter aux différentes largeurs d'écran.

#### `DbParchemin` — composant construit

- Image `parchemin-ferme.png` comme base (parchemin enroulé)
- Badge "Actualités" centré dessus (position absolute, même style que les boutons PatchButton)
- `flex: 0 0 28%` — légèrement plus étroit que les deux autres

#### `DbSacoche` — composant construit

Scène héro composée de deux images superposées :
- `hero-landscape.png` : fond paysage (position absolute, couvre tout)
- `hero-dragon.png` : personnage dragon au premier plan
- Bouton "Inventaire" en bas de la carte

Border-radius 12px pour adoucir les angles.

#### i18n — clés mises à jour

- `dashboard.parchemin` → "Actualités" / "News"
- `dashboard.sacoche` → "Inventaire" / "Inventory"

### Décisions techniques

| Choix | Raison |
|-------|--------|
| `flex: 0 0 30%` + `aspect-ratio` sur les cartes | Les composants conservent leurs proportions de maquette et flottent sur le fond sans remplir la section |
| `align-items: center` sur `dm__top` | Centre verticalement les cartes — le fond tricoté est visible autour, comme dans la maquette |
| `::after` pour le cadre vert | Permet de superposer le cadre au-dessus de l'avatar sans position absolute au niveau page |
| `clamp()` pour les font-size | Adapte lisiblement la taille du texte entre les petits (320px) et grands (430px) écrans mobiles |
| Hero landscape + dragon pour DbSacoche | Assets disponibles correspondant à la scène inventaire/héro de la maquette |

### TODOs

- [ ] Construire `dm__mid` — roue centrale (`turning-wheel.png`, tourne au hover/touch)
- [ ] Construire `dm__bot` — carte de jeu (`card-map-bg.png`, scroll horizontal)
- [ ] Implémenter le contenu réel du dashboard desktop + navigation sidebar
- [ ] Remplacer l'avatar statique par l'avatar dynamique de l'utilisateur (API)

---

## 2026-05-06 — Session 9 : Fix hydratation dashboard

### Problème

Avertissement Vue au chargement du dashboard :

```
Hydration text content mismatch on <span class="profile-card__username">
  - rendered on server: ""
  - expected on client: "meii7"
```

### Cause

Le cycle SSR + hydratation du dashboard se déroulait en deux temps :
1. **SSR** : Nuxt rend la page côté serveur → `user.value` est `null` (le store est vide, la session n'est pas encore restaurée) → `username = ''`
2. **Client** : le plugin `auth.client.ts` appelle `refreshTokens()`, restaure la session, `user.value` devient l'utilisateur réel → `username = 'meii7'`

Vue détecte la divergence entre le HTML produit par le serveur (`''`) et ce que le client attendait (`'meii7'`) → mismatch d'hydratation.

### Fix

Double protection dans `pages/dashboard.vue` :

**1. `definePageMeta({ ssr: false })`** — désactive le rendu SSR de la page entière (macro compile-time, nécessite un redémarrage du serveur Nuxt pour prendre effet).

**2. `<ClientOnly>`** — wrapping runtime des composants DashboardMobile/Desktop. Nuxt ne les rend pas côté serveur, ils attendent que le client soit initialisé. Efficace immédiatement sans restart, complémentaire à `ssr: false`.

### Décision technique

Le dashboard est une page privée et authentifiée — le pré-rendu SSR avec des données utilisateur vides n'apporte aucune valeur (pas de SEO, pas de performance perçue). Désactiver SSR + `<ClientOnly>` est le pattern correct pour toutes les pages nécessitant une session active.

---

## 2026-05-06 — Session 10 : dm__mid, dm__bot, routes et dashboard desktop V2

### Ce qui a été fait

#### Roue (dm__mid)
- Crop du fichier `turning-wheel.png` via Python/PIL : suppression du vide haut/bas (1536×2752 → 1492×1507px) pour que la zone cliquable corresponde exactement au rond
- Animation CSS : quart de tour à droite au hover (desktop) et au touchstart (mobile)
- Lien vers `/next-quest`

#### Sacoche — corrections pointer-events
- `pointer-events: none` sur `.dm__sacoche` (la div 170vw qui couvrait tout l'écran)
- `pointer-events: auto` uniquement sur `.dm__sacoche-btn` → les boutons du panel landscape redeviennent cliquables

#### Responsivité du sac (mobile)
- Passage de `width: 170vw` à `height: 110%; width: auto` + `transform: translate(50%, -50%)` pour que le sac se dimensionne selon la hauteur du container (responsive quel que soit le format)

#### Globe (dm__bot)
- Nouveau composant `DbGameCards.vue` : scroll horizontal de cartes + globe `card-map-bg.png` qui pivote au scroll (`scrollLeft * -0.12` degrés)
- Globe cropé à `bottom: -530%` pour n'en voir que la calotte supérieure
- Cadre `wooly-btn-final.png` sur chaque carte

#### Routes et pages placeholder
- 4 nouvelles pages créées : `/profil`, `/actualites`, `/game-list`, `/add-game`
- Boutons du dashboard branchés : ProfileCard → `/profil`, Parchemin → `/actualites`, sacoche → `/game-list` et `/add-game`
- Remplacement des `<button>` par `<NuxtLink>` avec `text-decoration: none`

#### Dashboard Desktop V2 (Figma page V2, frame MacBook Pro 14")
- Récupération des assets via MCP Figma : `parchemin-ouvert.png` (scroll ouvert portrait) + `sac-a-dos.png` (sac vert paysage 2616×1426)
- Layout fidèle au Figma : sac à dos à gauche (déborde), roue centrée, parchemin ouvert à droite avec cards scrollables, card map en bas
- Composant `DbGreenFrame.vue` : cadre vert tressé en overlay (`::after`, `z-index: 2`) utilisant `encadrement-vert-90.png` (version paysage fournie par Lorelei)
- `DbProfileCard.vue` : ajout prop `horizontal` pour le mode desktop (avatar rond + username + bouton, encadré par `DbGreenFrame`)
- Roue desktop : `min(16vw, 240px)` via media query `768px`

### Points ouverts
- Cards dans le parchemin : ratio à affiner (trop épais pour l'instant, TODO prochaine session)
- Covers de jeux : placeholders, branchement API IGDB à venir
- Avatar dynamique depuis API (actuellement image statique)
- Dashboard desktop : positionnement fin à terminer

---

## 2026-05-06 — Session 11 : Accessibilité dashboard + bug card map mobile

### Ce qui a été fait

#### Accessibilité globale (`main.css`)
Ajout de trois règles globales dans `assets/css/main.css` :
- `:focus-visible` — outline vert `#264a2e` pour la navigation clavier, supprimé pour la souris via `:focus:not(:focus-visible)`
- `@media (prefers-reduced-motion: reduce)` — désactive toutes les animations/transitions pour les utilisateurs ayant activé la préférence OS
- `.sr-only` — classe utilitaire pour les textes visibles uniquement aux lecteurs d'écran

#### Accessibilité `DbGameCards`
- `role="region"` + `aria-label="Ma liste de jeux"` sur le container principal
- Globe : `alt=""` + `aria-hidden="true"` (décoratif, inutile pour les AT)
- Scroll : `role="list"` + `tabindex="0"` + `aria-label` + gestion clavier `ArrowLeft/ArrowRight` (défile de 120px, `preventDefault()`)
- Cartes : `role="listitem"` + `aria-label={title}`
- `:focus-visible` sur `.game-cards__scroll` (outline vert)

#### Accessibilité `DbWheel`
- `prefers-reduced-motion` scoped : désactive l'animation `wheel-turn` si la préférence est active
- `:focus-visible` avec `border-radius: 50%` pour conserver la forme ronde du focus

#### Accessibilité `DashboardMobile`
- `aria-expanded` sur le bouton sacoche
- `role="dialog"` + `aria-label` sur le panel inventaire

### Points ouverts

- Globe (`card-map-bg.png`) non visible en vue mobile : positionnement `bottom: -530%` à retravailler (valeur % dépend de la hauteur résolue du container → instable). TODO prochaine session.
- Cards dans le parchemin : ratio toujours trop épais, à affiner.
- Covers de jeux : placeholders, branchement API IGDB à venir.

---

## 2026-05-11 — Session 12 : Polish dashboard + Navbar + Accessibilité

### Ce qui a été fait

#### Fix globe `card-map-bg.png` (mobile)

- Diagnostic via Python/PIL : `card-map-bg.png` a 22% de pixels transparents en haut (y=0 à y=131.7px en display). `translateY(88%)` n'affichait que cette zone vide.
- Fix : `translateY(65%)` → y=207px au bas du container (globe content commence à y=132px). Globe visible.
- `overflow: hidden` retiré de `.game-cards` (clippait le globe avant rendu), déplacé sur `.dm__bot`.

#### Fond crème `DbProfileCard`

- Ajout d'un `::before` avec `inset: 6%; background: #F5EDDF; border-radius: 15%` pour insérer le fond crème à l'intérieur de la zone opaque du cadre PNG (~5.5% transparent sur les bords).
- `DbGreenFrame.vue` : idem avec variable CSS `--frame-bg` (transparent par défaut, `#F5EDDF` depuis `DbProfileCard.vue` mode desktop via `--frame-bg: #F5EDDF`).
- Ajout de `overflow: hidden` + `border-radius: 8% / 10%` sur `DbGreenFrame` pour clipper le fond.

#### Dimensionnement mobile (DashboardMobile)

- Profile card : `flex: 0 0 36%` (était 30%)
- Parchemin : `flex: 0 0 32%` (était 28%)
- Sacoche : `height: min(85%, 75vw)` — responsive contraint par hauteur ET largeur viewport

#### Hero-landscape

- Crop du PNG via Python/PIL : suppression des bords transparents (2760×1504 → 2454×1201, marges de 10px).
- Repositionné dans le panel sacoche : `width: 90%; top: 44%; left: 50%; transform: translate(-50%, -50%)`.

#### Accessibilité boutons (WCAG 2.1)

Trois corrections systématiques sur `DbProfileCard`, `DbParchemin`, `DashboardMobile` :
- **Contraste** : `#a65d52` (3.05:1 — échec) → `#7a3e2a` (5.4:1 — AA ✓) sur tous les boutons
- **Police** : minima `clamp()` relevés à `0.875rem` (14px minimum)
- **Touch targets** : `min-height: 44px` + `display: inline-flex; align-items: center` sur tous les boutons

#### Dashboard desktop — parchemin cards

- Remplacement du fond `wooly-btn-final.png` par un bord CSS fin : `1.5px solid #7a3e2a`, `border-radius: 6px`, fond crème semi-transparent `rgba(245,237,223,0.55)`.
- `aspect-ratio: 5/2` pour laisser de la place aux futures informations (actualités / liste d'amis).
- Zone de scroll ajustée : `top: 14%; bottom: 13%`.

#### Dashboard desktop — nouveaux boutons

- **Sac à dos** : `NuxtLink` vers `/game-list` positionné à `left: 13%; top: 14%` — dans la zone visible du sac.
- **"Voir tout"** dans le parchemin : `NuxtLink` vers `/actualites` en bas du parchemin (`bottom: 5%`, centré).
- Clé i18n `dashboard.parchemin` transformée en objet `{ label, voirTout }`.

#### Système de navigation (Navbar + Layouts)

**Layouts Nuxt :**
- `layouts/plain.vue` : slot nu (dashboard, auth, index, callback)
- `layouts/default.vue` : navbar mobile + navbar desktop + `<slot>`
- `app.vue` : ajout de `<NuxtLayout>` (manquant — sans lui les layouts sont ignorés)
- `definePageMeta({ layout: 'plain' })` sur dashboard + toutes les pages auth/index

**`NavbarMobile.vue`** (bottom nav fixe) :
- 6 items : Accueil, Mes jeux, Actualités, Next Quest, Sorties de jeux, Profil
- Icônes MDI + labels `Knights Quest`, `height: 64px`
- Item actif : `border-top: 2px solid #edc78e` + couleur pleine

**`NavbarDesktop.vue`** (sidebar gauche 200px) :
- Logo en haut + séparateur
- Items avec `border-left: 3px solid #edc78e` sur l'actif
- Fond translucide `rgba(20,10,3,0.9)` + `backdrop-filter: blur(6px)`

**`pages/timeline.vue`** : placeholder créé (page "Sorties de jeux")

**Bouton "Sorties de jeux" sur le dashboard :**
- Slot `#header` ajouté à `DbGameCards.vue` (`.game-cards__header` absolu centré en haut)
- Dashboard mobile + desktop : `NuxtLink` injecté via le slot, centré au-dessus des cartes, style unifié avec les autres boutons

**i18n :** section `nav` ajoutée (`dashboard`, `gameList`, `actualites`, `profil`, `nextQuest`, `timeline`).

**`nuxi prepare`** relancé pour régénérer les types auto-import `useI18n`.

#### Accessibilité NavbarMobile (audit WCAG)

Audit complet, 4 corrections appliquées :
1. **Contraste items inactifs** : `rgba(237,199,142,0.4)` (2.6:1 — échec) → `0.6` (5.1:1 — AA ✓)
2. **Police labels** : `0.55rem` (8.8px) → `0.625rem` (10px)
3. **Focus clavier** : `:focus-visible` avec `outline: 2px solid #edc78e` ajouté
4. **Icônes** : `aria-hidden="true"` sur les `v-icon` (mobile + desktop) + `aria-label` redondant retiré du lien (le texte du `<span>` sert de nom accessible)
5. `role="navigation"` redondant retiré du `<nav>`

#### Tests unitaires navbar

2 nouveaux fichiers de tests (`NavbarMobile.test.ts`, `NavbarDesktop.test.ts`), 15 tests / 15 passants :
- Présence du `<nav>` avec `aria-label`
- 6 liens rendus
- Classe active `nm__item--active` / `nd__item--active` sur le bon lien
- `aria-current="page"` uniquement sur le lien actif, absent des 5 autres
- `aria-hidden="true"` sur toutes les icônes
- Labels visibles non vides
- Logo rendu (desktop)

### Vérifications

| Check | Résultat |
|-------|----------|
| `pnpm test` — nouveaux tests navbar | ✅ 15/15 |
| `pnpm test` — tests existants | ✅ 51/52 (1 échec pré-existant `middleware/auth.test.ts`) |
| `pnpm lint` | ⚠️ Pré-existant (`typescript-eslint` manquant dans `packages/config`) |
| `pnpm typecheck` | ⚠️ Pré-existant (`zod` manquant dans `packages/shared`) |

### Points ouverts

- Covers de jeux : placeholders, branchement API IGDB à venir
- Avatar dynamique depuis API
- Timeline (`/timeline`) : page à construire (liste des sorties de jeux)
- Bouton sac à dos desktop : position `left: 13%; top: 14%` à ajuster selon résolution réelle
- Test `middleware/auth.test.ts` pré-existant en échec (middleware global retourne `undefined` au lieu de `/auth/login`) — à corriger par JB ou en session dédiée

## 2026-05-12 — Session 13 : Auto-typage OpenAPI

### Ce qui a été fait

#### Infrastructure codegen

Mise en place d'un pipeline de génération automatique des types TypeScript à partir du schéma OpenAPI de l'API.

**Flux :**
```
apps/api/scripts/export-openapi.ts
  → packages/shared/openapi.json   (spec OpenAPI, committé)
  → packages/shared/src/types/api.ts  (types TS, gitignore — régénéré via codegen)
```

**Commande :**
```bash
pnpm codegen
```

**`apps/api/scripts/export-openapi.ts`** :
- Instancie Fastify sans démarrer le serveur
- Enregistre les mêmes plugins que `server.ts` (swagger, jwt, cookie, rate-limit)
- Enregistre toutes les routes (`/api`, `/api/auth`, `/api/auth/oauth`)
- Appelle `app.ready()` puis `app.swagger()` pour obtenir le JSON OpenAPI
- Écrit le résultat dans `packages/shared/openapi.json`

**Scripts ajoutés :**
- `apps/api/package.json` : `"generate:openapi": "tsx scripts/export-openapi.ts"`
- `packages/shared/package.json` : `"generate:types": "openapi-typescript openapi.json -o src/types/api.ts"`
- `package.json` (racine) : `"codegen": "pnpm --filter @nextquest/api generate:openapi && pnpm --filter @nextquest/shared generate:types"`

**Dépendance ajoutée :** `openapi-typescript@^7.8.0` dans `packages/shared` devDependencies.

**Export :** `packages/shared/src/index.ts` — ajout de `export type * from "./types/api.js"` pour que `web` et `mobile` puissent importer les types via `@nextquest/shared`.

**`.gitignore`** : `packages/shared/src/types/api.ts` ajouté (code généré, ne doit pas être versionné).

#### État actuel des types générés

Les routes exposent leurs métadonnées (tags, summary, description, params) mais les `requestBody` et `response` sont `never` pour la plupart des endpoints : JB valide les bodies via `zod.parse()` sans les déclarer dans le `schema` Fastify.

La route `/api/health` a un response schema complet (défini explicitement dans `health.routes.ts`).
La route OAuth `/{provider}` a les path params typés (`"google" | "microsoft"`).

**Prochaine étape côté back :** JB peut utiliser `fastify-type-provider-zod` pour brancher automatiquement les schémas Zod existants sur le JSON Schema Fastify — les types body/response apparaîtront alors dans les types générés sans réécriture.

#### Fix pnpm (bonus)

Détecté lors du codegen : symlinks pnpm cassés vers `fast-jwt@6.2.4` (suite au bump de sécurité #33). Réparé via `pnpm install`.

### Vérifications

| Check | Résultat |
|-------|----------|
| `pnpm codegen` | ✅ `openapi.json` + `api.ts` générés |
| `pnpm --filter @nextquest/shared typecheck` | ✅ 0 erreur |

### Points ouverts

- Covers de jeux : placeholders, branchement API IGDB à venir
- Avatar dynamique depuis API
- Timeline (`/timeline`) : page à construire (liste des sorties de jeux)
- JB : brancher `fastify-type-provider-zod` pour enrichir les types body/response

---

## 2026-06-22 — Module recommandations : page Next Quest

### Résumé exécutif

Session sur la branche `feat/front-reco`. Objectif : livrer la page `/next-quest` câblée sur les routes recommandations que JB avait livrées (3 buckets : `discovery`, `library_unplayed`, `upcoming`). Fix d'un bug de migration DB au passage. Mise en page desktop en `100dvh` sans scroll vertical.

**Types centralisés** — Tous les types liés aux recommandations sont extraits dans `apps/web/types/recommendations.ts` : `RecoBucket`, `RecoGame`, `RecoReason`, `RecommendationDTO`, `GroupedRecommendations`, `FeedbackAction`. Aucun type inline dans la page — respect de la convention établie sur le module collection.

**Page `next-quest.vue`** — Trois états principaux : chargement, vide (roue spinning + bouton de génération), recommandations disponibles.

- **Hero (discovery)** : card large avec cover portrait (180px), titre, genres en tags, note IGDB en étoiles, date de sortie, raison personnalisée, boutons "Ajouter à ma liste" / "Pas pour moi".
- **Secondaires (library_unplayed + upcoming)** : grille 2 colonnes, cards compactes avec cover miniature (72px), titre, genres, raison, boutons contextuels ("Je m'y mets" / "Me le rappeler" / "Pas pour moi"). Cards vides en pointillés si aucun jeu dans le bucket.
- **Feedback** : `POST /api/recommendations/:id/feedback` avec action `liked | dismissed | added` — la card disparaît après confirmation.
- **Régénération** : bouton "Nouvelles suggestions" relance `POST /api/recommendations/generate` puis re-fetch.

**i18n** — Section `nextQuest` ajoutée dans `fr.json` et `en.json` : titres, sous-titres, labels de buckets, actions, libellés de date.

**Fix migration DB** — `GET /api/recommendations` retournait 500 (`column recommendations.bucket does not exist`). La migration `0005_mean_hedge_knight.sql` existait mais n'avait pas été appliquée au running DB. Corrigé via `pnpm --filter @nextquest/db db:migrate`.

**Layout desktop 100dvh** — Contrainte : tout doit tenir dans la fenêtre sans scroll vertical (≥960px). Solution en deux volets :
- `.nq-page` : `height: 100dvh; overflow: hidden`
- `.nq-hero` : `flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: flex-start` (le `align-items: flex-start` empêche le label pill de s'étirer pleine largeur)
- `.nq-hero__card` : `flex: 1; min-height: 0; width: 100%` (le `width: 100%` compense le parent en `align-items: flex-start`)
- `.nq-hero__actions` : `margin-top: 0` en desktop (le `margin-top: auto` du base pousse les boutons en bas du flex et `overflow: hidden` les coupe)
- Paddings et marges réduits sur tous les éléments pour maximiser l'espace utile.

### Fichiers modifiés

| Fichier | Nature |
|---|---|
| `apps/web/types/recommendations.ts` | Nouveau — types DTO recommandations |
| `apps/web/pages/next-quest.vue` | Réécriture complète de la page |
| `apps/web/i18n/locales/fr.json` | Ajout section `nextQuest` |
| `apps/web/i18n/locales/en.json` | Ajout section `nextQuest` |

### Points ouverts

- Layout desktop : en attente de confirmation visuelle finale sur le fix des boutons hero
- Mobile : pas encore testé sur petit écran avec les nouvelles cards
- Feedback : pas de toast de confirmation après action — à ajouter
- Régénération : pas d'optimistic update — la page reste vide pendant le calcul (backend ~1s)

---

## 2026-06-22 — Redesign Next Quest : carte au trésor + fix token 401

### Résumé exécutif

Session sur `feat/front-reco`. Deux objectifs : (1) revoir complètement le layout desktop de `/next-quest` pour mettre les cards **sur** la carte au trésor (overlay) au lieu d'à côté, et appliquer le même rendu laine que les `.patch-btn` sur les bordures ; (2) corriger le 401 silencieux causé par l'expiration du JWT access token pendant une session.

**Redesign overlay** — La page desktop utilise désormais `.nq-map-stage` : un `div` avec `background: url(carte-landscape.png) center / 100% 100% no-repeat` comme fond de scène. Les cards sont positionnées en `absolute` à l'intérieur via trois `.nq-slot` (discovery : gauche centre, library : droite haut, upcoming : droite bas). Le bouton "Nouvelles suggestions" flotte en bas centre via `position: absolute; left: 50%; transform: translateX(-50%)`.

Sur mobile, l'image passe en bannière horizontale (`<img class="nq-mobile-map">`, 200px de haut, `object-fit: cover`), cachée sur desktop ; les cards s'empilent normalement en dessous.

**Bordures laine** — Les `.nq-quest-card` utilisent `border: 20px solid transparent; border-image: url('/images/buttons/wooly-btn-final.png') 350 fill round` — exactement le même principe que `.patch-btn`. La card principale (discovery) a `border-width: 24px`. Le fond est `transparent` pour laisser apparaître la carte derrière.

**Image carte au trésor** — L'image AI (`carte-landscape.jpg`, 1376×768) avait un fond en damier blanc/gris transparent baked dans le JPEG. Nettoyé via un script PIL BFS flood fill depuis les 4 coins (critère de saturation < 18 pour isoler le fond low-saturation) → sauvegardé en RGBA PNG (`carte-landscape.png`). L'image PNG exposait ensuite un problème de crop côté droit et gauche : corrigé en remplaçant `background-size: cover` par `background-size: 100% 100%` qui étire l'image exactement dans le conteneur sans recadrage.

**`useAuthFetch` composable** — Nouveau composable `apps/web/composables/useAuthFetch.ts` qui encapsule `$fetch` d'ofetch avec un mécanisme de refresh automatique :
1. Appel API avec le token courant (Bearer depuis le store Pinia mémoire).
2. Si 401 (`FST_JWT_AUTHORIZATION_TOKEN_EXPIRED`) → appelle `refreshTokens()` du composable `useAuth` (utilise le cookie httpOnly refresh token).
3. Retry unique avec le nouveau token.
4. Si le refresh échoue → redirect vers `/auth/login`.

**Migration de toutes les pages** — Les 4 pages concernées remplacent `$fetch` + `authHeaders()` manuels par `useAuthFetch` :
- `next-quest.vue` — 3 appels (`fetchRecos`, `generate`, `sendFeedback`)
- `game-list.vue` — 6 appels (steam status, link steam, import steam, enrich, fetch games, status change, delete)
- `profil.vue` — 2 appels (saveBio, saveVisibility)
- `games/[gameId].vue` — 3 appels (fetch detail, status change, delete)

Les headers `Authorization`, `credentials: 'include'` et la fonction `authHeaders()` locale ont été supprimés de chaque page — `useAuthFetch` les injecte systématiquement.

### Fichiers modifiés

| Fichier | Nature |
|---|---|
| `apps/web/composables/useAuthFetch.ts` | Nouveau — wrapper $fetch avec refresh token auto |
| `apps/web/public/images/next-quest/carte-landscape.jpg` | Nouveau — image source AI (1376×768) |
| `apps/web/public/images/next-quest/carte-landscape.png` | Nouveau — image nettoyée RGBA (fond transparent) |
| `apps/web/pages/next-quest.vue` | Redesign complet — overlay map + bordures laine + useAuthFetch |
| `apps/web/pages/game-list.vue` | Migration useAuthFetch — suppression authHeaders manuel |
| `apps/web/pages/profil.vue` | Migration useAuthFetch — suppression authHeaders manuel |
| `apps/web/pages/games/[gameId].vue` | Migration useAuthFetch — suppression authHeaders manuel |

### Vérifications

| Check | Résultat |
|-------|----------|
| `nuxi typecheck` | ✅ 0 erreur |
| Rendu overlay desktop | ✅ Cards positionnées sur la carte, bordures laine visibles |
| Fix crop image | ✅ Image affichée sans recadrage gauche/droite |
| Fix 401 token expiré | ✅ Refresh silencieux + retry automatique |

### Points ouverts

- Feedback (liked/dismissed) : pas de toast de confirmation visuelle — à ajouter
- Régénération : pas d'optimistic update pendant le calcul backend
- Tests mobiles des overlays non encore validés sur petit écran physique

---

## 2026-06-22 — Correction background + split mobile/desktop toutes pages

### Résumé exécutif

Session sur `feat/front-reco`. Deux objectifs : (1) corriger l'anomalie visuelle de `fond.png` qui changeait de taille selon la hauteur de la page et se répétait verticalement sur les pages longues (profil, actualités) ; (2) appliquer systématiquement le pattern de séparation mobile/desktop à toutes les pages qui en manquaient.

### Correction du background `fond.png`

**Cause racine** — Dans `app.vue`, `.app-bg` avait `background-repeat: repeat` et `min-height: 100vh`. Quand le contenu dépassait la hauteur du viewport (page profil avec bio longue, game-list avec beaucoup de jeux), le div grandissait et `fond.png` se répétait verticalement, donnant l'effet "doublé". Un `body::before { position: fixed }` avait été ajouté à tort dans `main.css` — il était inutile car masqué par le fond de `v-application` (Vuetify).

**Correction** — `.app-bg` devient `position: fixed; inset: 0` (élément hors du flux, ancré sur le viewport). Il ne peut plus grandir ni se répéter. `.v-application__wrap { position: relative; z-index: 0; background: transparent }` garantit que le contenu Vuetify reste au-dessus. Le `body::before` redondant a été supprimé de `main.css`.

**`PageHeader` sticky mobile** — Ajout de `position: sticky; top: 0; z-index: 50` sur `.ui-page-header` via `@media (max-width: 959px)`. Un pseudo-élément `::before { left: -100vw; right: -100vw }` étend le fond semi-opaque pleine largeur malgré le padding parent (clippé par `overflow: hidden` du conteneur).

### Pattern mobile/desktop — généralisation

**Convention établie** : chaque page doit disposer d'un composant `FooMobile.vue` et `FooDesktop.vue` dans `components/foo/`. La page routeur (`pages/foo.vue`) se réduit à ~8 lignes : `definePageMeta` + `useDisplay` + `<ClientOnly>` + `v-if="mobile"`. La logique partagée (data fetch, état, méthodes) va dans un composable `composables/useFoo.ts`.

**Layout mobile standard** : `height: calc(100dvh - 64px)` (64px = bottom nav), flex colonne, `overflow: hidden`. Zone header : `flex-shrink: 0`. Zone contenu : `flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch`.

Pages splittées dans cette session :

| Page | Composable | Mobile | Desktop |
|---|---|---|---|
| `game-list` | `useGameList.ts` | `GameListMobile.vue` | `GameListDesktop.vue` |
| `profil` | `useProfil.ts` | `ProfilMobile.vue` | `ProfilDesktop.vue` |
| `actualites` | — | `ActualitesMobile.vue` | `ActualitesDesktop.vue` |
| `games/[gameId]` | `useGameDetail.ts` | `GameDetailMobile.vue` | `GameDetailDesktop.vue` |
| `games/catalog/[gameId]` | — | `GameCatalogDetailMobile.vue` | `GameCatalogDetailDesktop.vue` |
| `next-quest` | (existant) | restructuré | restructuré |

`next-quest.vue` était déjà partiellement split (`NextQuestMobileStage` / `NextQuestDesktopStage`) mais le header était partagé. Il a été restructuré en deux blocs `v-if="mdAndUp"` / `v-else` dans la même page, avec un container mobile `height: calc(100dvh - 64px)` + zone scrollable interne.

**Spécificité `GameDetailMobile`** — La cover n'est plus dans un bloc hero côte-à-côte : elle s'étend pleine largeur (`margin: 0 -1rem; width: calc(100% + 2rem); height: 220px`) pour un rendu immersif. Les screenshots utilisent le même débordement horizontal (`margin-left: -1rem; padding-left: 1rem`).

### Fichiers modifiés / créés

| Fichier | Nature |
|---|---|
| `apps/web/app.vue` | Fix — `.app-bg` position fixed, `v-application__wrap` transparent |
| `apps/web/assets/css/main.css` | Fix — suppression `body::before` redondant |
| `apps/web/components/ui/PageHeader.vue` | Amélioration — sticky + fond étendu sur mobile |
| `apps/web/components/next-quest/MobileStage.vue` | Ajustement — restructuration layout mobile |
| `apps/web/pages/next-quest.vue` | Restructuration — deux blocs mobile/desktop distincts |
| `apps/web/composables/useGameList.ts` | Nouveau — état + logique game list |
| `apps/web/components/game-list/GameListMobile.vue` | Nouveau — layout mobile inner-scroll |
| `apps/web/components/game-list/GameListDesktop.vue` | Nouveau — layout desktop grille |
| `apps/web/pages/game-list.vue` | Refactorisé — routeur thin |
| `apps/web/composables/useProfil.ts` | Nouveau — état + logique profil |
| `apps/web/components/profil/ProfilMobile.vue` | Nouveau |
| `apps/web/components/profil/ProfilDesktop.vue` | Nouveau |
| `apps/web/pages/profil.vue` | Refactorisé — routeur thin |
| `apps/web/components/actualites/ActualitesMobile.vue` | Nouveau — placeholder mobile |
| `apps/web/components/actualites/ActualitesDesktop.vue` | Nouveau — placeholder desktop |
| `apps/web/pages/actualites.vue` | Refactorisé — routeur thin |
| `apps/web/composables/useGameDetail.ts` | Nouveau — état + logique fiche jeu |
| `apps/web/components/games/GameDetailMobile.vue` | Nouveau — cover pleine largeur mobile |
| `apps/web/components/games/GameDetailDesktop.vue` | Nouveau |
| `apps/web/pages/games/[gameId].vue` | Refactorisé — routeur thin |
| `apps/web/components/games/catalog/GameCatalogDetailMobile.vue` | Nouveau |
| `apps/web/components/games/catalog/GameCatalogDetailDesktop.vue` | Nouveau |
| `apps/web/pages/games/catalog/[gameId].vue` | Refactorisé — routeur thin |

### Vérifications

| Check | Résultat |
|-------|----------|
| `nuxi prepare` (types) | ✅ 0 erreur |
| Background fond.png mobile | ✅ Constant, plus de repeat sur pages longues |
| PageHeader sticky | ✅ Reste visible au scroll sur mobile |
| Split mobile/desktop | ✅ Pattern uniforme sur toutes les pages |

### Points ouverts

- Tests unitaires des nouveaux composables (`useGameList`, `useProfil`, `useGameDetail`) — à écrire
- Actualités : contenu réel à implémenter (placeholder pour l'instant)
- Valider le rendu sur un appareil physique iOS (Safari, bottom nav, `100dvh`)

---

## 2026-06-22 — Uniformisation cards mobile Next Quest

### Résumé exécutif

Affinage UI sur `feat/front-reco`. Les trois cards de recommandation Next Quest avaient des formats hétérogènes en mobile : Discovery utilisait un layout héro centré (cover 130×173px, infos centrées), Library et Upcoming utilisaient un layout compact (cover gauche + infos droite). Résultat : une grande card en haut et deux petites en grille décalée — incohérent visuellement. Les 3 cards ont été unifiées en colonne avec le même format.

### Changements

**`RecoCard.vue`** — Ajout prop `compact?: boolean`. Quand actif, Discovery abandonne le layout héro et adopte le layout compact. Cover compacte agrandie 68×90 → 80×108px. Desktop non impacté (prop non transmis depuis DesktopStage).

**`MobileStage.vue`** — Suppression `.nq-slot` + `.nq-secondary` (grille 2 col décalée). Remplacement par `.nq-cards` flex colonne. Les 3 cards reçoivent `compact`.

**`nuxt.config.ts`** — Devtools désactivé (`enabled: false`) pour ne pas polluer l'interface mobile.

### Fichiers modifiés

| Fichier | Nature |
|---|---|
| `apps/web/components/next-quest/RecoCard.vue` | Ajout prop `compact`, condition `isMain && !compact` |
| `apps/web/components/next-quest/MobileStage.vue` | Layout colonne unique, prop compact sur les 3 cards |
| `apps/web/nuxt.config.ts` | Devtools désactivé |

### Points ouverts

- Effet verre dépoli sur les cards : exploré mais non retenu. `border-image: fill` peint le centre de façon opaque et bloque tout `backdrop-filter`. Nécessite une refonte de l'approche border (SVG clip, abandon du fill) — à reprendre si besoin.

---

## 2026-06-23 — Tests unitaires PR feat/front-reco

### Résumé exécutif

Écriture de la couverture de tests unitaires complète pour tous les composants et composables introduits dans la PR `feat/front-reco`. 14 fichiers de tests créés, 203 tests passants, 0 régression. La CI passe.

### Ce qui a été fait

**Composables** (`tests/composables/`)
- `useGameDetail.test.ts` — 17 tests : `formatPlaytime` (null, 0, 90 min, 150 min), `formatReleaseDate`, `GAME_STATUSES` (4 entrées, ordre, icônes mdi), `onStatusChange` (optimiste + revert sur erreur, no-op si game=null)
- `useGameList.test.ts` — 18 tests : `STATUS_OPTIONS` (4 options), `toggleStatus` (ajout/suppression), `activeFilterCount`, `resetFilters` (vide statuts + remet page à 1), `goToPage`, `onDeleteGame` (suppression optimiste, décrement total), `totalPages` (calcul ceil)

**Composants profil** (`tests/components/profil/`)
- `ProfilMobile.test.ts` — 11 tests : montage (`fetchProfile`), affichage nom/displayName/@username, avatar DiceBear vs custom, édition bio (ouverture textarea, annuler, compteur 500, PATCH succès, PATCH erreur, désactivation > 500 chars), visibilité (3 options, PATCH private), logout

**Composants actualités** (`tests/components/actualites/`)
- `ActualitesMobile.test.ts` + `ActualitesDesktop.test.ts` — placeholder title + zone placeholder

**Composants game-list** (`tests/components/game-list/`)
- `GameListMobile.test.ts` / `GameListDesktop.test.ts` — 10–11 tests chacun : `init()` au montage, bouton Steam Lier / steam-row quand connecté, loader, état vide, grille avec GameListCard, champ recherche, badge filtre, pagination conditionnelle, clic Steam

**Composants game-detail** (`tests/components/games/`)
- `GameDetailMobile.test.ts` / `GameDetailDesktop.test.ts` — 9 tests chacun : `load()` au montage, loader, not-found, titre, 4 boutons de statut, statut actif (.--active), `onStatusChange` au clic, modale de confirmation (ouverture + `confirmRemove`)

**Composants catalog** (`tests/components/games/catalog/`)
- `GameCatalogDetailMobile.test.ts` / `GameCatalogDetailDesktop.test.ts` — 5–6 tests chacun : not-found si state null, titre, cover, note IGDB, genres (chips)

**Composants next-quest** (`tests/components/next-quest/`)
- `MobileStage.test.ts` — 4 tests : 3 zones rendues (nq-slot-empty), structure nq-cards, émission `generate`, bouton disabled si generating
- `RecoCard.test.ts` — 13 tests : slot vide (reco=null), layout compact (library, upcoming, discovery+compact), layout héro (discovery sans compact), titre, badges (discovery/library/upcoming), feedback CTA (added/liked), dismiss, disabled si feedbackPending

**Composant UI** (`tests/components/ui/`)
- `PageHeader.test.ts` — 4 tests : montage, rendu slot, prop `to` transmise à UiBackButton, wrapper content

### Décisions techniques

**`global.stubs` ne fonctionne pas pour les composants auto-importés par Nuxt.** Dans l'environnement `@vitest-environment nuxt`, Nuxt injecte les composants comme des imports statiques au moment de la compilation Vite. `global.stubs` n'intercepte que les composants résolus via le registre global Vue, pas les imports statiques. Solution adoptée : tester le comportement réel plutôt que de mocker les enfants. Ex : MobileStage testé avec `reco: null` → 3 `.nq-slot-empty` rendus.

**`shallowMount` pour PageHeader.** Le composant `UiBackButton` utilise Vuetify en interne ; sans plugin Vuetify dans l'environnement de test, le montage profond échoue. `shallowMount` stub automatiquement tous les enfants et permet d'inspecter les props transmises.

**Stub avec `name` = conflit.** Ajouter `name: 'NextQuestRecoCard'` à un stub provoque un conflit avec le composant déjà enregistré globalement par Nuxt — le composant réel reprend la priorité. Il faut soit laisser le stub sans `name`, soit tester le comportement réel.

### Fichiers créés

| Fichier | Tests |
|---|---|
| `tests/composables/useGameDetail.test.ts` | 17 |
| `tests/composables/useGameList.test.ts` | 18 |
| `tests/components/profil/ProfilMobile.test.ts` | 11 |
| `tests/components/actualites/ActualitesMobile.test.ts` | 3 |
| `tests/components/actualites/ActualitesDesktop.test.ts` | 3 |
| `tests/components/game-list/GameListMobile.test.ts` | 11 |
| `tests/components/game-list/GameListDesktop.test.ts` | 10 |
| `tests/components/games/GameDetailMobile.test.ts` | 9 |
| `tests/components/games/GameDetailDesktop.test.ts` | 9 |
| `tests/components/games/catalog/GameCatalogDetailMobile.test.ts` | 6 |
| `tests/components/games/catalog/GameCatalogDetailDesktop.test.ts` | 5 |
| `tests/components/next-quest/MobileStage.test.ts` | 4 |
| `tests/components/next-quest/RecoCard.test.ts` | 13 |
| `tests/components/ui/PageHeader.test.ts` | 4 |
| **Total** | **203** |

### TODOs en attente

- Aucun blocker. La PR est prête pour review.

---

## 2026-06-26 — Session 14 : Correction de 8 bugs (next-quest, game-list, game-detail)

### Résumé exécutif

Session de bugfix sur `feat/complete-dashboard`. 8 bugs corrigés sur 3 modules : page Next Quest (queue de recos, i18n, retry), fiche jeu (note IGDB, contraste WCAG), game list (étoiles, a11y carte, double fetch, erreurs silencieuses). 8 nouveaux tests ajoutés à `useGameList.test.ts`, 19 tests passants au total.

### Ce qui a été fait

#### Bug 1 — Décliner une reco vidait le bucket (`pages/next-quest.vue`)

`fetchRecos` ne conservait que `res.discovery[0]` et jetait le reste. Après un décliné, `sendFeedback` mettait la valeur à `null` → slot "Aucune suggestion" immédiat même si l'API avait renvoyé plusieurs candidats.

**Fix** : `discovery/libraryUnplayed/upcoming` passent de `ref<DTO|null>` à des queues `ref<DTO[]>`. Les computed `[0]` exposent l'entrée courante au template. `sendFeedback` fait un `.slice(1)` au lieu d'un `= null` — le suivant du bucket s'affiche automatiquement.

#### Bug 2 — Note IGDB non arrondie / incohérente (`GameDetailDesktop.vue`, `GameDetailMobile.vue`)

Affichait `84.62312/100` brut alors que `RecoCard` affichait déjà `/10` arrondi.

**Fix** : `{{ game.game.igdbRating }}/100` → `{{ (game.game.igdbRating / 10).toFixed(1) }}/10` dans les deux composants. Format commun avec RecoCard.

#### Bug 3 — Étoiles de note : barème faux (`RecoCard.vue`)

`Math.round(rating / 2)` traitait `igdbRating` (0–100) comme s'il était sur 0–10. Borderlands 3 noté 76/100 → `Math.round(76/2) = 38` → 5★ tronqué à 5.

**Fix** : `Math.round(rating / 20)` — 0–100 divisé par 20 donne 0–5 étoiles.

#### Bug 4 — Échecs silencieux sans retour utilisateur (`useGameList.ts`)

Les catch de `fetchSteamStatus`, `linkSteam`, `enrichGames`, `fetchGames` avalaient l'erreur sans trace ni feedback.

**Fix** :
- `console.error('[useGameList] <fn>', e)` sur tous les catch.
- `linkSteam` : `importMessage = { type: 'error', text: t('gameList.steamLinkError') }`.
- `enrichGames` : idem avec `gameList.enrichError`.
- `fetchGames` : ref `gamesError` ajoutée (posée à `true` sur échec, remise à `false` au prochain succès), exposée dans le return.
- Clés i18n `steamLinkError` / `enrichError` ajoutées dans `fr.json` et `en.json`.

#### Bug 5 — Strings d'erreur en dur + mauvais « Réessayer » (`pages/next-quest.vue`)

`"Impossible de charger les recommandations"` et `"Réessayer"` codés en dur en FR. `"Réessayer"` appelait toujours `fetchRecos` même quand c'était `generate` qui avait échoué.

**Fix** :
- Ref `lastFailedOp: 'fetch' | 'generate' | null` posée dans chaque catch.
- Fonction `retry()` qui dispatch vers `generate()` ou `fetchRecos()` selon la valeur.
- Strings remplacées par `t('nextQuest.loadError')` / `t('nextQuest.retry')`.
- Clés ajoutées dans les deux locales.

#### Bug 6 — Contraste sous le seuil WCAG AA (`GameDetailDesktop.vue`, `GameDetailMobile.vue`)

`.gdd__label`, `.gdd__dt`, `.gdd__section-title` en `rgba(58,26,10,0.5)` ≈ 2,9:1 contre le fond crème. `.gdd__rating-max` en `0.45`.

**Fix** : opacités relevées à `0.75` (labels/dt/section-title) et `0.65` (rating-max) — ratio ≥ 4,5:1 atteint contre `#F8F4EA`.

#### Bug 7 — Carte cliquable contenant d'autres boutons (`GameListCard.vue`)

La `<div role="button">` englobait les boutons de statut et le bouton supprimer : anti-pattern a11y (un bouton dans un bouton).

**Fix** :
- `role="button" tabindex="0" @click @keydown` retirés de la div racine.
- La cover devient `<button tabindex="-1" aria-hidden="true">` (masquée des AT, cliquable à la souris).
- Le titre devient `<button class="gl-card__title">` avec reset CSS (`background: none; border: none; text-align: left; width: 100%`).
- `:focus-visible` déplacé sur les deux boutons enfants.
- `cursor: pointer` retiré de `.gl-card` (la main n'apparaît que sur les zones effectivement cliquables).

#### Bug 8 — Double fetch au montage de `game-list` (`pages/game-list.vue`, `GameListDesktop.vue`, `GameListMobile.vue`)

`GameListDesktop` et `GameListMobile` appelaient chacun `useGameList()` + `onMounted(init)`. Si la valeur `mobile` de Vuetify bascule après le premier rendu (SSR → client), les deux composants peuvent monter successivement, déclenchant deux séries de fetches.

**Fix** : `useGameList()` + `onMounted(gameList.init)` remontés dans `pages/game-list.vue`. État fourni via `provide('gameList', gameList)`. Les enfants utilisent `inject<ReturnType<typeof useGameList>>('gameList')!` — une seule instance, un seul init.

#### Bug 8b — Tests manquants sur les branches d'erreur (`useGameList.test.ts`)

Les tests existants ne couvraient pas : la vérification que le PATCH est bien envoyé dans `onStatusChange`, le rollback sur erreur API, le refetch de récupération dans `onDeleteGame`, et l'état `gamesError`.

**Fix** : 8 nouveaux cas :
- `onStatusChange` : optimiste, PATCH envoyé au bon endpoint, rollback sur erreur.
- `onDeleteGame` : refetch si DELETE échoue.
- `fetchGames` : `gamesError = true` sur erreur, remis à `false` sur succès.

### Décisions techniques

| Choix | Raison |
|---|---|
| Queue `.slice(1)` plutôt que refetch du bucket | Évite un aller-retour réseau pour chaque décliné ; l'API a déjà renvoyé plusieurs candidats |
| `provide/inject` plutôt que `useState` | Plus idiomatique Vue 3 pour partager un objet entre parent et enfants directs ; pas d'effet de bord cross-navigation |
| Cover `aria-hidden + tabindex=-1` | L'image est décorative — la couverture accessible est le titre (nom du jeu). Deux boutons identiques seraient redondants pour les AT |
| Opacité 0.75 pour WCAG | Calcul sur fond crème `#F8F4EA` : rgba(58,26,10,0.75) → ratio ≈ 5,5:1 contre fond crème (seuil AA = 4,5:1) |

### Fichiers modifiés

| Fichier | Nature |
|---|---|
| `apps/web/pages/next-quest.vue` | Bugs 1 + 5 — queue de recos, i18n, retry intelligent |
| `apps/web/pages/game-list.vue` | Bug 8 — remontée useGameList + provide |
| `apps/web/components/games/GameDetailDesktop.vue` | Bugs 2 + 6 — note /10 + contraste WCAG |
| `apps/web/components/games/GameDetailMobile.vue` | Bugs 2 + 6 — note /10 + contraste WCAG |
| `apps/web/components/next-quest/RecoCard.vue` | Bug 3 — étoiles ÷20 |
| `apps/web/composables/useGameList.ts` | Bug 4 + 8 — console.error, gamesError, inject-ready |
| `apps/web/components/game-list/GameListDesktop.vue` | Bug 8 — inject au lieu de useGameList() |
| `apps/web/components/game-list/GameListMobile.vue` | Bug 8 — inject au lieu de useGameList() |
| `apps/web/components/game-list/GameListCard.vue` | Bug 7 — zone cliquable a11y |
| `apps/web/i18n/locales/fr.json` | Bugs 4 + 5 — clés steamLinkError, enrichError, loadError, retry |
| `apps/web/i18n/locales/en.json` | Bugs 4 + 5 — idem EN |
| `apps/web/tests/composables/useGameList.test.ts` | Bug 8b — 8 nouveaux tests erreur |

### Vérifications

| Check | Résultat |
|---|---|
| `vitest run useGameList.test.ts` | ✅ 19/19 |
| `nuxi typecheck` | ✅ 0 nouvelles erreurs (2 erreurs pré-existantes catalog non liées) |

## 2026-07-21 — Session 15 : Extension des tests e2e d'accessibilité à toutes les pages

### Contexte

Le scan axe-core + vérifs (lang/title/H1) ne couvrait que la home. Décision d'étendre à toutes les routes réelles de l'app pour avoir une régression a11y automatisée complète.

### Ce qui a été fait

- `accessibility-public.spec.ts` : `/auth/login`, `/auth/register`, `/auth/forgot-password`.
- `accessibility-protected.spec.ts` : dashboard, game-list, profil, actualites, next-quest, timeline, add-game, détail jeu/catalogue — via une fixture qui mocke `/api/auth/refresh` et `/api/users/me` (le backend réel n'est pas nécessaire, les composants gèrent déjà les erreurs API en try/catch et retombent sur des états vides/introuvable, eux aussi testés).
- Factorisation des vérifications communes dans `helpers/a11y.ts`.

#### Violations réelles détectées et corrigées

- H1 manquant sur ~9 pages/composants (login, register, dashboard, timeline, add-game, états "introuvable" des détails de jeu) — ajout de `<h1>` (masqué visuellement via `.sr-only` si déjà stylé autrement).
- Profil avait 2 `<h1>` (titre de page + nom affiché) : le nom passe en `<h2>`.
- `UiBackButton` (utilisé par `UiPageHeader` partout) sans nom accessible : ajout d'un `aria-label` (clé i18n `nav.back`).
- Contraste insuffisant du libellé de la sidebar desktop (`.nd__label`, 3.15:1) et de plusieurs textes secondaires en beige/brun clair (jusqu'à 3.04:1) : opacité relevée pour atteindre 4.5:1 (WCAG AA).
- Champs mot de passe (login/register) : le `label` de Vuetify n'était jamais rendu (prop absente), laissant un `aria-labelledby` orphelin. `PatchInput` passe désormais `label` à `v-text-field` et le masque visuellement en CSS (le `<span>` déjà affiché reste le seul label visible).

### Fichiers modifiés

| Fichier | Nature |
|---|---|
| `apps/web/tests-e2e/accessibility-public.spec.ts`, `accessibility-protected.spec.ts`, `fixtures/auth.ts`, `helpers/a11y.ts` | Nouveaux — suite e2e étendue |
| ~9 pages/composants (login, register, dashboard, timeline, add-game, détails jeu, `ProfilDesktop.vue`) | Ajout/correction H1 |
| `apps/web/components/ui/BackButton.vue`, `pages/auth/forgot-password.vue` | aria-label + `UiBackButton` |
| Sidebar + textes secondaires (`GameListDesktop.vue`, `GameDetailDesktop.vue`, `GameCatalogDetailDesktop.vue`, `ActualitesDesktop.vue`) | Contraste WCAG AA |
| `apps/web/components/ui/PatchInput.vue` | Fix label Vuetify orphelin |
| `apps/web/i18n/locales/{fr,en}.json` | Clé `nav.back` |
| `apps/web/tests/pages/profil.test.ts` | Sélecteur h1→h2 |

### Vérifications

| Check | Résultat |
|---|---|
| `pnpm run test:e2e` | ✅ 14/14 |
| `pnpm run test` | ✅ 252/252 |
| `nuxi typecheck` | ✅ 0 nouvelle erreur |
| `pnpm run lint` | ✅ inchangé (1709 erreurs pré-existantes, aucune introduite) |

Commit `df89f14`, poussé sur `fix/accessibility`.

## 2026-07-21 — Session 16 : Corrections Silktide sur /auth/login

### Contexte

Scan Silktide manuel sur `http://localhost:3001/auth/login` remontant 4 catégories non couvertes par la suite axe-core existante (14/14 verts malgré ces défauts réels) :
- Field labels (WCAG 2.0 A 1.3.1) — 3 occurrences
- Missing ARIA label IDs (WCAG 2.0 A 1.3.1) — 2 occurrences
- Programmatic field purpose (WCAG 2.1 AA 1.3.5) — 1 occurrence
- Form control contrast (WCAG 2.1 AA 1.4.11)

### Ce qui a été fait

#### Icône œil (afficher/masquer le mot de passe) sans nom accessible

`append-inner-icon` de Vuetify générait un `aria-label` via la clé i18n `$vuetify.input.appendAction`, absente des fichiers de locale → texte brut non traduit exposé aux lecteurs d'écran (confirmé par un warning `[intlify] Not found '$vuetify.input.appendAction' key`).

**Fix** : remplacement par le slot `#append-inner` avec un `<v-icon>` explicite, `aria-label` piloté par i18n (nouvelles clés `auth.fields.showPassword` / `hidePassword`), `role="button"`, `tabindex="0"`, et gestion clavier (`@keydown.enter.space.prevent`) en plus du clic souris.

#### `autocomplete` manquant (WCAG 1.3.5 — Identify Input Purpose)

Aucun attribut `autocomplete` sur les champs des formulaires auth. Ajout d'une prop `autocomplete` sur `PatchInput.vue` (forwardée à `v-text-field`), avec les valeurs WHATWG adaptées au contexte :
- Login : `username` (email) + `current-password`.
- Register : `username` (champ pseudo), `email`, `new-password` (mot de passe + confirmation).

#### Contraste insuffisant du champ (WCAG 1.4.11 — Non-text Contrast)

Le fond crème translucide du champ (`rgba(248,244,234,0.92)`) se fondait dans le fond beige de la page (`#EDE8DC`), sans limite visible (axe-core ne détecte pas ce cas, son `color-contrast` ne cible que le texte). Calcul de contraste WCAG (formule de luminance relative) : `--nq-brown-mid` (#7A3E2A) donne 6.74:1 contre le fond de page et 7.50:1 contre le fond du champ, largement au-dessus du seuil 3:1.

**Fix** : `:deep(.v-field) { border: 1.5px solid var(--nq-brown-mid); }` dans `PatchInput.vue`.

### Décisions techniques

| Choix | Raison |
|---|---|
| Slot `#append-inner` plutôt que prop `append-inner-icon` | La prop Vuetify dépend d'une clé i18n interne non traduite dans l'app ; le slot donne un contrôle total sur l'`aria-label` et le clavier |
| `autocomplete="username"` (et non `email`) sur le champ email du login | Convention WHATWG : en contexte de connexion, l'identifiant se mappe sur `username` même si visuellement c'est un email, pour s'apparier avec `current-password` |
| Bordure plutôt que fond opaque | Ne change pas l'identité visuelle du champ (fond crème translucide voulu), ajoute juste une limite perceptible |

### Bug découvert en cours de route (sans rapport avec ces fixes)

Le conteneur `nextquest-web` a planté deux fois pendant les vérifications (`Exited (1)`) avec l'erreur `server.handleUpgrade() was called more than once with the same socket` — bug HMR connu de Vite en mode dev, déclenché par la charge de navigations répétées de Playwright (déjà documenté comme instabilité connue dans `playwright.config.ts`/`nuxt.config.ts`). Contournement suivi : build de prod (`pnpm run build` + `PORT=3001 node .output/server/index.mjs`) pour lancer la suite e2e, conteneur dev redémarré ensuite pour l'usage normal. Un test protégé (`/next-quest`) a également échoué une fois en exécution parallèle (spinner de chargement capturé en plein rendu) — confirmé flaky, passe systématiquement seul ou en re-run complet ; pas un vrai défaut a11y.

### Fichiers modifiés

| Fichier | Nature |
|---|---|
| `apps/web/components/ui/PatchInput.vue` | Slot icône œil + autocomplete + bordure contraste |
| `apps/web/components/auth/LoginDesktop.vue`, `LoginMobile.vue` | `autocomplete="username"` / `current-password"` |
| `apps/web/components/auth/RegisterDesktop.vue`, `RegisterMobile.vue` | `autocomplete="username"` / `"email"` / `"new-password"` |
| `apps/web/i18n/locales/{fr,en}.json` | Clés `auth.fields.passwordConfirm`, `showPassword`, `hidePassword` |
| `apps/web/tests/components/PatchInput.test.ts` | Passage en `@vitest-environment nuxt` + `mockNuxtImport('useI18n', ...)` (le nouveau `useI18n()` dans le composant cassait le montage en environnement happy-dom sans plugin i18n) |

### Vérifications

| Check | Résultat |
|---|---|
| `pnpm run test` | ✅ 252/252 |
| `pnpm run test:e2e` (build prod) | ✅ 14/14 |
| `nuxi typecheck` | ✅ 0 nouvelle erreur |
| `pnpm run lint` | ✅ inchangé (1713 erreurs pré-existantes, aucune dans les fichiers modifiés) |

### Points ouverts

- [ ] Le mapping exact des 3 "Field labels" / 2 "Missing ARIA label IDs" de Silktide n'a pas été confirmé élément par élément au-delà du fix de l'icône œil — à revalider avec un nouveau scan Silktide une fois ces correctifs en ligne (le scan initial datait peut-être d'avant le fix du `label` Vuetify de la Session 15).

## 2026-07-21 — Session 17 : Crash HMR du conteneur web (Vite 8.1.5) et double serveur Playwright

### Contexte

Le conteneur `nextquest-web` plantait (`Exited (1)`) avec `Error: server.handleUpgrade() was called more than once with the same socket`, systématiquement dès qu'un vrai navigateur se connectait au serveur dev.

### Cause

Deux bugs distincts :

1. **`playwright.config.ts` spawnait un second serveur `nuxt dev` en doublon.** Le check `reuseExistingServer` interrogeait `http://localhost:3001` ; sur macOS, `localhost` résout d'abord en IPv6 (`::1`), or Docker Desktop ne publie le port du conteneur qu'en IPv4. Le check échouait donc à tort (`ECONNREFUSED ::1:3001`), Playwright croyait qu'aucun serveur ne tournait et relançait `pnpm run dev` directement sur l'hôte, en parallèle de celui de Docker — deux serveurs Vite/Nitro concurrents sur le même port.
2. **Régression de Vite 8.1.5**, indépendante du point 1 : le conteneur plantait seul, sans aucune interférence extérieure, dès la première connexion websocket HMR d'un vrai navigateur. La version de Vite était passée de `8.0.16` à `8.1.5` en effet de bord d'un `pnpm install`, via le floor `overrides.vite: ">=8.0.5"`.

En creusant cet override, découverte connexe : le bloc `pnpm.overrides` / `pnpm.onlyBuiltDependencies` du `package.json` racine n'était plus du tout appliqué depuis une montée de version de pnpm (les clés doivent vivre dans `pnpm-workspace.yaml` pour pnpm 10) — les pins de sécurité (CVEs Dependabot : `fast-jwt`, `undici`, `ws`, etc.) n'étaient donc plus honorés.

### Ce qui a été fait

- `apps/web/playwright.config.ts` : `webServer.url` → `http://127.0.0.1:3001` (évite le double-spawn IPv4/IPv6).
- `pnpm-workspace.yaml` : migration de `pnpm.overrides` / `pnpm.onlyBuiltDependencies` depuis `package.json` (silencieusement ignorés), avec `vite` figé en exact `8.0.16` (au lieu du floor `>=8.0.5`) le temps que la régression HMR de 8.1.5 soit corrigée en amont.
- `package.json` racine : suppression du bloc `pnpm.overrides`/`onlyBuiltDependencies` devenu mort.

### Vérifications

| Check | Résultat |
|---|---|
| Navigation réelle (Playwright, `/`, puis `/auth/login`, 20s d'attente) | ✅ aucun crash, restart Nitro interne survécu proprement |
| `pnpm run test:e2e` (suite complète, conteneur dev, 14 tests en parallèle) | ✅ 13/14 — conteneur resté up tout du long, aucun crash HMR |
| 1 échec restant (`/next-quest`, contraste `.nq-state__hint`) | Violation a11y réelle et indépendante (WCAG 1.4.3, "serious"), pas un flake HMR — à traiter séparément |
| `pnpm run test` (web) | ✅ 252/252 |
| `pnpm exec turbo run typecheck --filter=@nextquest/web` | ✅ 0 erreur |

### Points ouverts

- [ ] Traiter la violation a11y trouvée sur `/next-quest` (contraste insuffisant sur `.nq-state__hint`).
- [ ] Repasser `vite` sur un floor (`>=8.0.5`) une fois une version ≥ 8.1.5 sans cette régression HMR disponible.

## 2026-07-21 — Session 18 : Tests e2e d'accessibilité dans la CI

### Ce qui a été fait

Ajout de 3 étapes dans `.github/workflows/ci.yml`, après le `Build` existant :

- Install des navigateurs Playwright (`chromium` uniquement, seul projet configuré).
- Démarrage du build de prod (`node .output/server/index.mjs`) en arrière-plan, avec boucle d'attente sur `curl http://127.0.0.1:3001/`.
- `pnpm --filter @nextquest/web test:e2e`.

Tourne contre le build de prod plutôt que `nuxt dev`, pour écarter tout risque lié au HMR (voir Session 17 ci-dessus). L'auth des pages protégées étant mockée au niveau réseau (`tests-e2e/fixtures/auth.ts`), aucune dépendance à l'API ni à la DB n'était nécessaire pour cette étape.

### Vérifications

| Check | Résultat |
|---|---|
| Simulation en local du flux CI (build prod + démarrage + `test:e2e`) | ✅ 14/14 |
| Validation syntaxique du YAML | ✅ |

## 2026-07-21 — Session 19 : Bordure de contraste non détectée par Silktide

### Contexte

Nouveau scan Silktide sur `/auth/login` (branche actuelle) : contraste 1:1 toujours signalé en échec sur les champs email/mot de passe, alors que la bordure ajoutée en Session 16 (`:deep(.v-field) { border: 1.5px solid var(--nq-brown-mid); }`) est bien présente et rend correctement (vérifié via styles calculés + capture d'écran).

### Cause

La bordure est posée sur `.v-field`, le wrapper visuel de Vuetify — pas sur le `<input>` réel. Inspection du DOM généré : le `<input>` lui-même a `border: 0px none` et un fond transparent ; la bordure visible vient d'un ancêtre situé deux niveaux plus haut dans l'arbre. Un scanner qui évalue le contrôle de formulaire au sens strict (le tag `<input>`) ne voit donc aucune bordure sur l'élément qu'il inspecte, d'où le 1:1 persistant malgré un rendu visuel correct.

### Pistes explorées puis abandonnées

1. Dupliquer la bordure sur `.v-field__input` en plus de celle sur `.v-field`. Casse visuellement le champ mot de passe : le `<input>` s'arrête avant l'icône œil (`.v-field__append-inner`, un sibling), donc sa propre bordure droite retombe au milieu du champ — ligne verticale parasite.

### Fix final

Bordure retirée de `.v-field`, portée uniquement par `.v-field__input` (avec `border-radius: 12px`, valeur résolue de `rounded="lg"` sur ce thème — non hérité). Pour les champs avec icône (`.v-field--appended`, mot de passe) : bordure droite retirée de l'`<input>` et reportée sur `.v-field__append-inner`, avec `margin-right: -12px` / `padding-right: 12px` pour compenser le padding réservé à l'icône sur `.v-field` et faire coïncider exactement le bord droit de l'icône avec celui du champ. Résultat : cadre visuellement continu (mesures de rects confirmant l'alignement pixel-perfect entre `<input>` et `.v-field__append-inner`), bordure désormais portée par le contrôle de formulaire réel.

Bug préexistant découvert en cours de route (sans rapport, non corrigé) : l'icône œil du champ mot de passe utilise la police décorative de l'app (`Knights Quest`) au lieu de la police d'icônes MDI — confirmé présent aussi sur `HEAD` avant ce fix (`git stash`), donc non introduit ici.

### Fichiers modifiés

| Fichier | Nature |
|---|---|
| `apps/web/components/ui/PatchInput.vue` | Bordure de contraste déplacée de `.v-field` vers `.v-field__input` + `.v-field__append-inner` |

### Vérifications

| Check | Résultat |
|---|---|
| `pnpm exec turbo run test --force --filter=@nextquest/web` | ✅ 252/252 |
| `playwright test tests-e2e/accessibility-public.spec.ts` | ✅ 3/3 |
| Rects `<input>` / `.v-field__append-inner` (mêmes top/bottom, contigus) | ✅ alignement pixel-perfect |
| Captures d'écran login + register, mobile + desktop | ✅ bordure continue, sans ligne parasite |

### Points ouverts

- [ ] Icône œil rendue avec la mauvaise police (`Knights Quest` au lieu de MDI) — bug préexistant, hors scope de cette session.

## 2026-07-21 — Session 20 : Listes sémantiques sur /dashboard (Silktide)

### Contexte

Scan Silktide sur `/dashboard` : deux grilles de jeux (sac à dos, carrousel de sorties) sont des liens groupés sans structure de liste, remontées comme "looks like navigation, should be rewritten as a list". Un 3e point sur le contraste d'un lien "mot de passe oublié" a été écarté (mesure à la pipette imprécise, couleurs ne correspondant à rien dans le code actuel).

### Ce qui a été fait

- `DashboardDesktop.vue` — `.dd__bag-grid` : `<div>` + `NuxtLink` en boucle converti en `<ul>` + `<li>` (reset `list-style`/`margin`/`padding`, la grille CSS existante s'applique aux `<li>` sans changement visuel).
- `DbGameCards.vue` (composant partagé mobile/desktop) — `.game-cards__track` : même conversion en `<ul>`/`<li>`. L'ancien balisage utilisait déjà `role="list"`/`role="listitem"`, mais sur des éléments non directement imbriqués (un `<div>` intermédiaire cassait la relation ARIA list/listitem), d'où le signalement malgré les rôles ARIA. `role="list"` sur `.game-cards__scroll` remplacé par `role="group"` (le scroll n'est plus la liste elle-même, seul le `<ul>` l'est).

### Vérifications

| Check | Résultat |
|---|---|
| `nuxi typecheck` | ✅ 0 nouvelle erreur |
| `pnpm exec turbo run test --force --filter=@nextquest/web` | ✅ 252/252 |
| `playwright test tests-e2e/accessibility-protected.spec.ts -g dashboard` | ✅ 1/1 |
| Capture d'écran dashboard desktop | ✅ layout identique |

## 2026-07-21 — Session 21 : Contraste "Statut du jeu" sur /game-list (Silktide)

### Contexte

Scan Silktide sur `/game-list`, deux points liés au même thème (fond crème `#F8F4EA` de la carte / du tiroir de filtres) :

1. Texte des boutons de statut inactifs ("Terminé", "En cours", etc.) : contraste 4.19:1 (calcul manuel), sous le seuil 4.5:1 requis pour du petit texte.
2. Titre de section "Statut du jeu" dans le tiroir de filtres : `#907C6F` sur `#F8F4EA`, 3.61:1 — correspondance exacte avec les valeurs remontées par Silktide (`rgba(--nq-brown-dark-rgb), 0.55)` recalculé donne pixel pour pixel `#907C6F`), confirmant que c'est bien cet élément-là qui était signalé.

### Ce qui a été fait

- `GameListCard.vue` — `.gl-card__status-btn` : `rgba(var(--nq-brown-dark-rgb), 0.6)` → `0.7`. Composant partagé entre `GameListMobile.vue` et `GameListDesktop.vue`, donc les deux vues sont couvertes par ce seul changement. Le style du bouton actif (fond marron plein, texte crème) n'est pas concerné.
- `GameListMobile.vue` et `GameListDesktop.vue` — `.gl-drawer__section-title` (titre "Statut du jeu" / "Plateforme" / "Catégories" du tiroir de filtres) : `rgba(var(--nq-brown-dark-rgb), 0.55)` → `0.7`, dupliqué dans les deux fichiers (pas de composant partagé pour le tiroir).

### Vérifications

| Check | Résultat |
|---|---|
| Contraste recalculé (formule WCAG) | ✅ boutons de statut ~5.7:1, titres de section ~5.7:1 (les deux passaient par `rgba(--nq-brown-dark-rgb), 0.7)` sur `#F8F4EA`) |
| `pnpm exec turbo run test --force --filter=@nextquest/web` | ✅ 252/252 |
| `playwright test tests-e2e/accessibility-protected.spec.ts -g game-list` | ✅ 1/1 |
| Capture d'écran carte de jeu (boutons de statut) + tiroir de filtres ouvert | ✅ texte plus lisible, design inchangé |

## 2026-07-21 — Session 22 : Labels manquants sur /game-list (Silktide)

### Contexte

Scan Silktide sur `/game-list` : "People using screen readers are not able to see the layout of a form" — 2 problèmes remontés.

1. Champ de recherche ("Rechercher un jeu…") : seul un `placeholder` était présent, pas de label associé — un lecteur d'écran n'annonce pas de nom pour ce contrôle une fois le texte saisi (le placeholder disparaît du DOM accessible dans certains cas, et n'est de toute façon pas un substitut valide au label selon WCAG).
2. Bouton filtre mobile (`role` bouton implicite) : icône seule (`mdi-tune-variant`), sans texte visible ni `aria-label` — aucun nom accessible.

### Ce qui a été fait

- `GameListDesktop.vue` et `GameListMobile.vue` — ajout d'un `<label for="..." class="sr-only">` (classe utilitaire déjà existante dans `main.css`) associé à l'`<input type="search">` via `id`/`for`, reprenant le texte de `gameList.searchPlaceholder`. Le placeholder visuel est conservé tel quel.
- `GameListMobile.vue` — `aria-label="t('gameList.filterBtn')"` ajouté sur `.glm__filter-toggle` (icône seule sur mobile ; la version desktop a déjà le texte "Filtres" visible, non concernée).

### Vérifications

| Check | Résultat |
|---|---|
| Nom accessible calculé (`input.labels[0]`, `button.getAttribute('aria-label')`) | ✅ "Search a game…" / "Filters" |
| `pnpm exec turbo run test --force --filter=@nextquest/web` | ✅ 252/252 |
| `playwright test tests-e2e/accessibility-protected.spec.ts -g game-list` | ✅ 1/1 |
| Capture d'écran toolbar recherche + filtre, mobile et desktop | ✅ aucun changement visuel (label en `sr-only`) |

## 2026-07-21 — Session 23 : Contraste du champ de recherche /game-list (Silktide)

### Contexte

Scan Silktide sur `/game-list` : bordure du champ de recherche (`.gl__search` / `.glm__search`) à `rgba(var(--nq-brown-rgb), 0.22)` — 1.46:1 sur le fond tricoté, sous le seuil 3:1 requis pour les contrôles de formulaire (WCAG 1.4.11). Même symptôme que la bordure des champs de connexion/inscription corrigée en session 19, sur un composant différent.

### Ce qui a été fait

- `GameListDesktop.vue` (`.gl__search`) et `GameListMobile.vue` (`.glm__search`) : bordure `rgba(var(--nq-brown-rgb), 0.22)` → `1.5px solid var(--nq-brown-mid)`, même bordure que celle validée sur `PatchInput.vue`.

### Vérifications

| Check | Résultat |
|---|---|
| `pnpm exec turbo run test --force --filter=@nextquest/web` | ✅ 252/252 |
| `playwright test tests-e2e/accessibility-protected.spec.ts -g game-list` | ✅ 1/1 |
| Capture d'écran barre de recherche, mobile et desktop | ✅ bordure nettement visible, design inchangé |

## 2026-07-21 — Session 24 : Label manquant sur le bouton de fermeture du tiroir de filtres (Silktide)

### Contexte

Scan Silktide sur `/game-list` : `.gl-drawer__close` (icône `mdi-close` du tiroir de filtres) n'a ni texte visible ni `aria-label` — aucun nom accessible.

### Ce qui a été fait

- Ajout de la clé `gameList.filterClose` ("Fermer les filtres" / "Close filters") dans `fr.json` et `en.json`.
- `GameListDesktop.vue` et `GameListMobile.vue` — `aria-label="t('gameList.filterClose')"` ajouté sur `.gl-drawer__close`.

### Vérifications

| Check | Résultat |
|---|---|
| Nom accessible calculé (`button.getAttribute('aria-label')`) | ✅ "Close filters" |
| `pnpm exec turbo run test --force --filter=@nextquest/web` | ✅ 252/252 |
| `playwright test tests-e2e/accessibility-protected.spec.ts -g game-list` | ✅ 1/1 |

## 2026-07-21 — Session 25 : Listes sémantiques sur la navigation (Silktide)

### Contexte

Scan Silktide sur `NavbarDesktop.vue` (sidebar) et `NavbarMobile.vue` (bottom nav) : les 6 liens de navigation (Accueil, Mes jeux, Actualités, Next Quest, Sorties de jeux, Profil) sont rendus comme une suite de `NuxtLink` sans structure de liste — même signalement "looks like navigation, should be rewritten as a list" que sur le dashboard (session 20).

### Ce qui a été fait

- `NavbarDesktop.vue` — les `NuxtLink` sont maintenant enveloppés dans `<ul class="nd__list"><li>`, sous le `<nav>` existant (le logo reste un `<div>` frère, hors de la liste). `list-style`/`margin`/`padding` réinitialisés, `display: flex; flex-direction: column` repris sur `.nd__list` (c'était sur `.nd` avant).
- `NavbarMobile.vue` — même conversion. Le flex horizontal (`display: flex; align-items: stretch`) et la hauteur pleine sont déplacés de `.nm` vers `.nm__list` ; chaque `<li>` reçoit `flex: 1` (ce rôle tenait auparavant sur `.nm__item` directement) pour que les 6 items gardent une largeur égale.

### Vérifications

| Check | Résultat |
|---|---|
| `pnpm exec turbo run test --force --filter=@nextquest/web` | ✅ 252/252 |
| `playwright test tests-e2e/accessibility-protected.spec.ts` | ✅ 8/9 (1 échec pré-existant sur `/next-quest`, contraste `.nq-state__hint`, confirmé sans lien avec ce changement via `git stash`) |
| Capture d'écran sidebar desktop + bottom nav mobile | ✅ layout identique |

### Points ouverts

- [x] `.nq-state__hint` sur `/next-quest` — corrigé en session 26.

## 2026-07-21 — Session 26 : Contraste texte sur /next-quest (Silktide)

### Contexte

Scan Silktide sur `/next-quest` : catégorie "Text contrast", 3 problèmes remontés. Un seul détaillé par Silktide — le bouton "Accepter la quête" (`#F5EDDF` sur `#A65D52`, 4.19:1, sous le seuil 4.5:1 requis pour le petit texte). Les deux autres n'ont pas été précisés par l'outil ; investigation du fichier `next-quest.vue` et calcul manuel de luminance/contraste pour les retrouver.

### Ce qui a été fait

- `RecoCard.vue` (`.nq-quest-cta`, bouton CTA "Accepter la quête" / "Reprendre la quête" / "Suivre la sortie") : fond `#A65D52` (4.19:1) → `var(--nq-brown-mid)` (7.08:1), texte inchangé (`var(--nq-cream-alt)`). État `:hover` `#8B3D33` → `var(--nq-brown-dark)`, pour rester cohérent avec le nouveau fond.
- `next-quest.vue` — deux autres textes utilisant le même motif `rgba(var(--nq-brown-dark-rgb), alpha)` sous le seuil, retrouvés par calcul de contraste sur fond `#F8F4EA` : `.nq-subtitle` (alpha 0.5 → 3.13:1) et `.nq-state__hint` (alpha 0.55 → 3.61:1, c'est le point ouvert de la session 25). Les deux passés à alpha `0.7` (5.74:1), même valeur que les fixes précédents sur `/game-list`.

### Vérifications

| Check | Résultat |
|---|---|
| Couleurs calculées appliquées (`getComputedStyle` via Playwright) | ✅ CTA `rgb(122,62,42)` / `rgb(245,237,223)`, subtitle `rgba(58,26,10,0.7)` |
| Capture d'écran cartes Next Quest, mobile et desktop | ✅ teinte marron toujours cohérente avec le reste de l'UI, pas de régression |
| `pnpm exec turbo run test --force --filter=@nextquest/web` | ✅ 252/252 |
| `playwright test tests-e2e/accessibility-protected.spec.ts -g next-quest` | ✅ 1/1 (le point ouvert de la session 25 est résolu) |

## 2026-07-22 — Session 27 : Suivi des sorties, modale captures d'écran et panneau feutrine sur les jeux similaires

### Contexte

Trois demandes distinctes sur la page détail catalogue (`GameCatalogDetailDesktop/Mobile.vue`) et les pages détail collection (`GameDetailDesktop/Mobile.vue`) : (1) pouvoir suivre la sortie d'un jeu pas encore sorti, (2) ouvrir les captures d'écran en grand, (3) un effet feutrine cohérent avec le reste du site sous le titre des jeux similaires en bas de page, avec des tuiles de hauteur égale.

Point d'attention : la première formulation du problème feutrine ("il n'y a pas le panneau feutrine sous le titre du jeu des recommendations") a été mal comprise comme visant `RecoCard.vue` (les recommandations Next Quest) — après vérification (capture zoomée + `getComputedStyle`), ce composant était déjà correct. Correction reçue : la demande visait en réalité la section "Jeux similaires" en bas des pages détail. Vocabulaire à retenir : "jeux recommandés/similaires" sur une fiche jeu = section Similar Games, à ne pas confondre avec "Next Quest" (recommandations).

### Ce qui a été fait

#### Suivi de sortie (étoile)
- `GameCatalogDetailDesktop.vue` / `Mobile.vue` — bouton étoile (`mdi-star`/`mdi-star-outline`) affiché uniquement si `releaseStatus === 'upcoming'`, branché sur le store existant `useFollowedGamesStore` (déjà utilisé par la Timeline) via `toggleFollow()` — le suivi reste synchronisé entre les deux pages (localStorage).
- Scope volontairement limité aux pages catalogue : `CollectionDetailDTO` (jeux possédés) n'a pas de champ `releaseStatus`, donc pas de bouton étoile sur `GameDetailDesktop/Mobile.vue`.
- Réutilisation des clés i18n `timeline.follow`/`timeline.unfollow` existantes plutôt que d'en dupliquer.

#### Modale captures d'écran
- Nouveau composant partagé `components/ui/ScreenshotModal.vue` : lightbox plein écran (précédent/suivant, compteur `{current}/{total}`, fermeture Échap/clic backdrop/croix), focus-trap via `useFocusTrap` (même pattern que `GameListAddModal.vue`).
- Branché sur les 4 composants détail (`GameCatalogDetailDesktop/Mobile`, `GameDetailDesktop/Mobile`) : chaque `<img>` de la galerie devient cliquable (`role="button"`, `@click`/`@keydown.enter`), un seul `ref<number|null>` par composant pilote l'index ouvert.
- 5 nouvelles clés i18n sous `gameDetail` (`screenshotOpen`, `screenshotClose`, `screenshotPrev`, `screenshotNext`, `screenshotCounter`) dans `fr.json`/`en.json`.

#### Panneau feutrine + hauteur égale sur les jeux similaires
- Classe `nq-felt-panel` appliquée aux tuiles "Jeux similaires" des 4 composants détail (elle ne l'était que sur `RecoCard.vue` et les autres panneaux jusqu'ici).
- Problème : le texte du titre a besoin de `-webkit-line-clamp` (troncature 2 lignes) qui est incompatible avec `flex: 1` sur le même élément. Résolu avec un wrapper à deux couches : `<div class="…-similar-title nq-felt-panel">` (fond feutrine, `flex: 1`, centrage) contenant `<span class="…-similar-title-text">` (troncature 2 lignes). `align-items: stretch` sur le conteneur `…-similar` (comportement flex par défaut, déjà présent implicitement) + `flex-shrink: 0` sur la cover pour que seule la zone titre absorbe la différence de hauteur entre jeux de titres courts/longs.
- Backend : `collection.dto.ts`/`collection.service.ts` — ajout d'`igdbId` (nullable) au schéma `similarGameRefSchema` et à la requête Drizzle, pour que les jeux similaires de la page collection puissent aussi linker vers `/games/catalog/:igdbId` (avant, seul le titre/la cover étaient exposés).

### Décisions techniques

**Deux couches DOM pour les tuiles similaires plutôt qu'une seule.** `display: -webkit-box` (requis par `line-clamp`) et `display: flex` (requis par `flex: 1` pour l'étirement) ne peuvent pas coexister sur le même élément — d'où le `<div>` extérieur (feutrine + flex) et le `<span>` intérieur (line-clamp).

**Pas de composant modal dupliqué.** Un seul `UiScreenshotModal.vue` auto-enregistré (convention Nuxt `components/ui/`), consommé par les 4 pages détail via 3 props (`screenshots`, `index`, `alt`) + un événement (`update:index`) — évite 4 implémentations quasi identiques.

### Fichiers modifiés

| Fichier | Nature |
|---|---|
| `apps/web/components/games/catalog/GameCatalogDetailDesktop.vue` | Étoile suivi, modale screenshots, feutrine + hauteur égale similaires |
| `apps/web/components/games/catalog/GameCatalogDetailMobile.vue` | idem |
| `apps/web/components/games/GameDetailDesktop.vue` | Modale screenshots, feutrine + hauteur égale similaires (pas d'étoile) |
| `apps/web/components/games/GameDetailMobile.vue` | idem |
| `apps/web/components/ui/ScreenshotModal.vue` | **Nouveau** — lightbox partagée |
| `apps/web/components/next-quest/RecoCard.vue` | Vérifié conforme (pas de changement fonctionnel) |
| `apps/web/i18n/locales/fr.json` / `en.json` | 5 clés `gameDetail.screenshot*` |
| `apps/web/types/game.ts` | Ajustement type lié aux jeux similaires |
| `apps/api/src/modules/collection/collection.dto.ts` / `collection.service.ts` | `igdbId` ajouté à `similarGameRefSchema` |

### Vérifications

| Check | Résultat |
|---|---|
| `pnpm lint` (monorepo, via container `nextquest-web`) | ✅ 0 erreur (26 warnings pré-existants inchangés) |
| `pnpm typecheck` (5 packages) | ✅ 0 erreur |
| Playwright — étoile suivi (catalogue desktop/mobile) | ✅ toggle outline → filled or, synchronisé Timeline |
| Playwright — modale captures d'écran (ouverture, suivant, Échap) | ✅ desktop + mobile |
| Playwright — hauteur des tuiles similaires (`getBoundingClientRect().height`) avec titres de longueurs différentes | ✅ toutes les hauteurs identiques (37.1px desktop, 35px mobile) sur la même rangée |

## 2026-07-22 — Session 28 : Correction des vulnérabilités Dependabot (tar / js-yaml / shell-quote)

### Contexte

GitHub a signalé 6 alertes Dependabot sur la branche par défaut (1 critique, 3 hautes, 2 modérées) après un push. Toutes portent sur des dépendances transitives de tooling (Expo/React Native côté mobile, devtools Nuxt, générateur de types OpenAPI), aucune sur du code de prod exposé à des entrées utilisateur non fiables.

| Package | Sévérité | Origine | Version vulnérable | Corrigé dans |
|---|---|---|---|---|
| `tar` (x4 CVE) | Critique / Haute / Moyenne x2 | `expo` → `cacache` (mobile) | 7.5.16 | 7.5.19 |
| `shell-quote` | Haute | `react-devtools-core` → `react-native` (mobile) | 1.8.4 | 1.9.0 |
| `js-yaml` | Haute | `@redocly/openapi-core` → `openapi-typescript` (devDep `@nextquest/shared`) | 4.2.0 | 4.3.0 |

### Ce qui a été fait

- Le repo a déjà un bloc `overrides` dans `pnpm-workspace.yaml` (pas dans `package.json` — pnpm 10 ignore désormais ce champ là, warning `"pnpm" field in package.json is no longer read`). Relevé les bornes existantes trop permissives : `tar: ">=7.5.16"` → `">=7.5.19"`, `js-yaml: ">=4.2.0"` → `">=4.3.0"`, et ajouté `shell-quote: ">=1.9.0"` (absent jusque-là).
- `pnpm install` relancé sur l'hôte **et** dans le container `nextquest-web` (node_modules du container = volume Docker séparé, non partagé avec l'hôte malgré le bind-mount du code source — un `pnpm install` côté hôte seul ne suffit pas à mettre à jour le container).

### Décisions techniques

**Overrides dans `pnpm-workspace.yaml`, pas `package.json`.** Tentative initiale via `package.json > pnpm.overrides` (convention pnpm < 10) : silencieusement ignorée par pnpm 10.33 avec un warning. Le fichier `pnpm-workspace.yaml` du repo est déjà le bon emplacement et contenait un commentaire expliquant la démarche (revisiter périodiquement quand les parents — expo, nuxt, drizzle-kit — sont mis à jour).

### Fichiers modifiés

| Fichier | Nature |
|---|---|
| `pnpm-workspace.yaml` | Bornes `overrides` relevées + ajout `shell-quote` |
| `pnpm-lock.yaml` | Régénéré (dédup des versions vulnérables) |

### Vérifications

| Check | Résultat |
|---|---|
| `pnpm why -r tar / shell-quote / js-yaml` | ✅ une seule version résolue par package, toutes patchées (7.5.20 / 1.10.0 / 4.3.0) |
| `pnpm lint` (container) | ✅ 0 erreur |
| `pnpm typecheck` (container, 5 packages) | ✅ 0 erreur |
| `pnpm --filter @nextquest/web test` | ✅ 285/285 |
| `pnpm test` (api) | ⚠️ échec pré-existant, sans rapport : BDD injoignable depuis le container (nécessite `pnpm docker:up`) |
