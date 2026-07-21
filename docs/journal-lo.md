# Journal de bord — Lorelei

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
