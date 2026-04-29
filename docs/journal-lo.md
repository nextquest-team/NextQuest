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
