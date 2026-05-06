# Journal de bord — Lorelei

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

