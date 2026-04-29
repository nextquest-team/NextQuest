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

- [ ] Intégrer la police **Knight Quest** : placer le `.woff2` dans `public/fonts/` et mettre à jour `main.css`
- [ ] Implémenter OAuth Google / Microsoft / Apple (en attente des routes backend — JB)
- [ ] Créer la page `/auth/forgot-password`
- [ ] Créer le dashboard et mettre à jour les redirections post-login
- [ ] Renommer le fichier fond.png (déjà fait) ✓
- [ ] Ajouter les SVG des providers sociaux dans `public/images/social/`
- [ ] Dockeriser l'API et mettre à jour `NUXT_PUBLIC_API_BASE` dans docker-compose
