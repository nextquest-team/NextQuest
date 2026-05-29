# Journal de Bord -- Jean-Baptiste (Backend)

**Equipe :** Jean-Baptiste (backend) / Lorelei (frontend)
**CDA :** Soutenance le 16 juillet 2027 | **MVP :** 26 juin 2026

---

## 31 mars 2026

**Monorepo** -- Mise en place pnpm workspaces + Turborepo. 3 apps (`api`, `web`, `mobile`) + 3 packages partages (`shared`, `config`, `db`). Permet le partage de types et validateurs entre toutes les apps.

**Frontend** -- Nuxt 3 (web) + Expo (mobile). Vue.js car enseigne chez ForEach. React Native car standard cross-platform le plus mature.

**Infra** -- Docker Compose avec PostgreSQL 16 et Redis 7.

---

## 1er avril 2026

**Schema BDD** -- Conception et creation du schema complet (34 tables, 16 enums). Decisions cles :
- Separation `platforms` (hardware) vs `services` (ecosystemes) en many-to-many
- Separation `auth_providers` (Google/Discord = identite) vs `connected_services` (Steam/PSN = import gaming)

**Module auth (design)** -- email/password (Argon2id) + OAuth Google/Discord. JWT access (15min) + refresh token (30j, cookie HttpOnly, hash SHA-256 en BDD). Sessions en BDD avec device tracking.

**Audit securite (4 passes)** -- Schema audite contre OWASP Top 10, RGPD, NIST SP 800-63B. Audit trail, consentements RGPD, cascades ON DELETE, detection de vol de refresh token, rate limiting, chiffrement. 0 probleme en passe finale.

**Migrations Drizzle** -- Schema TypeScript en 14 fichiers (`packages/db/src/schema/`). Migration generee et appliquee sur PostgreSQL. BDD operationnelle.

**Module auth (implementation)** -- Register, login, refresh token (rotation avec detection de vol), logout, logout-all. Endpoints testes et fonctionnels. Cookie HttpOnly pour le web, body JSON pour le mobile.

**Infra PC distant** -- Docker avec PostgreSQL + Redis sur PC Windows, accessible via Tailscale + SSH. Auto-login configure, Docker au demarrage, reboot distant fonctionnel.

---

## 14 avril 2026

**OAuth Google + Microsoft** -- Implementation du flow Authorization Code cote serveur. Architecture extensible : chaque provider est isole dans son propre fichier avec une interface commune (`exchangeCode` + `getUserProfile`). Apple prevu plus tard, l'architecture est prete.

**Logique find-or-create** -- A la connexion OAuth : si le provider est deja lie on login, si l'email existe on lie automatiquement, sinon on cree un nouveau compte. Liaison et deliaison de providers sur un compte existant.

**Correction error handling** -- Les erreurs Zod renvoient maintenant 400 (au lieu de 500), et les erreurs de doublon PostgreSQL renvoient 409. 23 tests unitaires et d'integration.

---

## 29 avril 2026

**Tests OAuth en conditions reelles** -- Apps Google + Microsoft creees, flows testes via Chrome DevTools MCP. Le scenario cross-provider valide : un user qui s'inscrit via Google puis se reconnecte via Microsoft (meme email) retrouve son compte avec les 2 providers lies.

**Endpoint `/auth/me`** -- Renvoie le profil du user connecte (id, email, username, displayName, avatarUrl, bio, locale, visibility, role, emailVerified). Necessaire pour que le front affiche l'utilisateur apres OAuth ou refresh de page.

**Documentation Swagger** -- Tous les endpoints groupes en 3 tags (Health, Auth, OAuth) avec descriptions. Lorelei peut explorer l'API via http://localhost:3000/docs et tester les requetes directement.

**Infra dev distante** -- Docker Postgres + Redis tournent sur un PC Windows fixe, accessible via Tailscale (l'IP du tailnet reste prive). Nouveau PC, donc workaround pour le credential helper Docker Desktop sur SSH non-interactif (pre-pull des images en local sur le PC).

**CI/CD industrialisee** -- La CI GitHub Actions inclut maintenant lint + typecheck + migrations + tests + build, avec services Postgres 16 et Redis 7 ephemeres. Ajout de CodeQL (analyse de securite OWASP Top 10), Dependabot (updates auto des deps + actions), template de PR et CODEOWNERS (reviewers auto par chemin). Configs eslint reparees : chaque package re-exporte `@nextquest/config/eslint` pour satisfaire le flat config d'ESLint 9+.

**Branch protection automatisee** -- Configuration appliquee via `gh` CLI plutot qu'a la main : 2 rulesets actifs sur `develop` et `main` (1 review, code owner review, CI verte, linear history, no force push, squash + rebase only). Repository settings figes : default branch `develop`, auto-delete des branches mergees, pas de merge commits, Dependabot alerts + security updates ON. Lorelei et JB co-owners (pas de "restrict who can push"). Reste a faire manuellement : passer le repo en public pour activer Secret scanning et Code scanning gratuitement (sinon CodeQL ne peut pas uploader). Detail dans `docs/setup-github.md`.

**Hardening securite (CodeQL + Dependabot)** -- Apres ouverture du repo en public, CodeQL et Dependabot ont remonte des alertes. Resolution complete : workflow CI passe en `permissions: contents: read` (moindre privilege sur le `GITHUB_TOKEN`), `@fastify/rate-limit` enregistre globalement (300 req/min) avec overrides stricts sur les routes auth (`register` 5/15min, `login` 10/min, `refresh` 30/min) et OAuth (`initiation` 30/min, `callback` 20/min, `link` 10/min) pour bloquer brute-force et creation de comptes en masse. Health probe exclu du rate limit. 32 alertes Dependabot resolues via `pnpm.overrides` cible (`fast-jwt`, `fastify`, `tar`, `vite`, `defu`, `lodash`, `xmldom`, `esbuild`, `postcss`, `uuid`, `unhead`+`@unhead/vue` epingles 2.x pour Nuxt, `@fastify/static`) plutot qu'un bulk `pnpm update --latest` qui aurait casse les peer deps Nuxt. Workflow CodeQL custom retire au profit du default setup deja actif (sinon SARIF refuse en double). `pnpm audit` retourne 0 vulnerabilite. Bonus : `tsconfig` API exclut maintenant les `__tests__` du build (sinon `pnpm build` compile les `.test.ts` dans `dist/` et vitest les execute en double).

**Fix overflow `sessions.device_name`** -- Bug remonte par Lorelei pendant ses tests front : register/login renvoyaient 500 sur Safari. L UA Safari recent fait 121 chars, or il etait insere dans `device_name` (varchar 100) en plus de `user_agent`. Fix : passer `undefined` pour `device_name` tant qu il n y a pas d UI de naming d appareil, l UA reste capture dans `user_agent` (text). 2 tests ajoutes pour verrouiller le cas (UA > 100 chars sur register et login). Note DBML clarifiee pour eviter la rechute.

---

## 5 mai 2026

**Onboarding profil + flag** -- Nouveau module `apps/api/src/modules/users/` avec `GET /api/users/me`, `PATCH /api/users/me`, `POST /api/users/me/onboarding/complete`. Colonne `onboarding_completed` ajoutee a `users` (boolean, default false). Le tour guide front pilote par Lorelei mettra le flag a true a sa fin. Le back ne connait pas les etapes UX du tour, juste cet etat binaire.

**DTO public centralise** -- `toUserDTO()` dans `users.dto.ts` est la source unique de verite pour le format user expose au client. `/auth/me` refactore pour l utiliser. Garantit que `passwordHash`, `failedLoginAttempts`, `lockedUntil`, `deletedAt`, `role`, `emailVerifiedAt` ne fuitent jamais via une route. Le `role` reste accessible cote client via le claim JWT.

**RGPD cascade documente** -- Regle ajoutee a `CLAUDE.md` : toute FK vers `users.id` = `ON DELETE CASCADE` par defaut, avec exceptions pour audit (SET NULL) et messages recus (soft delete + anonymisation sender). Audit complet du schema a faire lors de la spec dediee `DELETE /api/users/me`.

**Avatar upload reporte** -- Pour le MVP, `avatarUrl` est juste une URL string (max 2048). L upload custom (storage + multipart + redimensionnement) est reporte a la spec profil/settings post-MVP.

**Fix env vitest** -- `apps/api/vitest.config.ts` charge maintenant le `.env` racine et hookTimeout passe a 30s (les DELETE de cleanup sur Postgres en reseau Tailscale depassent le default 10s). Sans ca les tests d integration BDD echouaient en local. CI non impactee (vars injectees via secrets workflow).

---

## 12 mai 2026

**Review PR #31 (dashboard Lorelei) en stack Docker remote** -- Pour reproduire fidelement l'env de Lorelei et avoir un setup proche de la prod, deploiement de la stack complete (`api` + `web` en plus de `pg` + `redis`) sur le PC distant via Docker compose. Test end-to-end depuis le Mac : register email/password, OAuth Google, OAuth Microsoft, redirect dashboard, middleware auth privee. BDD verifiee post-test : `users`, `auth_providers` et `sessions` correctement remplis, `password_hash` null pour OAuth, refresh tokens en SHA-256 (64 chars), expires_at +30j.

**Setup HTTPS Tailscale serve** -- Active HTTPS Certs sur le tailnet (Let's Encrypt auto via `tailscale cert`). Configure `tailscale serve` pour proxy `localhost:3001` -> `https://desktop-8q9ttcc.tail52abfa.ts.net` (port 443) et `localhost:3000` -> port 8443. Necessaire car Microsoft OAuth refuse le HTTP hors localhost. Cert valide partout dans le browser, equivalent a ce qu'on aura en prod. Setup propre defendable au jury.

**Rebase PR #31 sur develop** -- La branche `dashboard` de Lorelei avait 10 commits fantomes (squash-merge GitHub) qui creaient 16+ conflits sur `package.json`, `pnpm-lock.yaml`, fichiers auth. Force-push apres cherry-pick de ses 8 vrais commits sur develop tip, regeneration du lockfile, 52/52 tests vert. PR mergeable.

**Fix CORS configurable (branche `fix/api-cors-configurable`)** -- CORS hardcode a `localhost:3001` dans le plugin Fastify, bloquait tout dev distant. Refacto : lecture depuis `CORS_ORIGINS` (CSV) avec fallback localhost. Ajout du `docker/docker-compose.override.yml` au gitignore (config locale par poste, override des URLs Tailscale sans toucher au compose committe). Branche poussee, PR a creer.

**Backlog backend identifie pendant la review** :
- **`trustProxy` Fastify** : `ip_address` des sessions vaut `172.18.0.1` (gateway Docker) au lieu de la vraie IP client. Activer `trustProxy: true` cote Fastify pour lire `X-Forwarded-For`. Concerne aussi la prod (toujours derriere un reverse proxy).
- **Double session OAuth** : login Google/MS cree 2 entrees dans `sessions` a 1 seconde d'ecart. Suspicion de double-create dans `apps/api/src/modules/auth/oauth/oauth.routes.ts`. A investiguer.
- **`API_BASE_URL` dans le compose** : le compose committe definit `API_BASE_URL=http://api:3000` (nom de service Docker interne), mais cette URL est utilisee par `buildCallbackUrl()` pour le `redirect_uri` envoye a Google/MS, qui doit etre joignable par le **browser**. En l'etat le compose ne marche que sur localhost. A corriger cote compose ou cote `buildCallbackUrl` (lire une autre variable).

---

## 21 mai 2026

**Resolution du backlog post-review #31 (PR fix groupee)** -- Les 3 issues #34, #35, #36 fixees dans une seule branche `fix/oauth-sessions-docker` (3 commits separes pour la review).

**#34 trustProxy** -- Ajout de `trustProxy: true` a la config Fastify (`apps/api/src/server.ts`). `request.ip` lit maintenant `X-Forwarded-For` (premier hop) au lieu de l'IP TCP brute. Indispensable pour que `sessions.ip_address` et le rate-limiter par IP soient corrects en prod derriere un reverse proxy.

**#35 Double session OAuth** -- Cause reelle differente de l'hypothese initiale : pas un double `createSession` cote API, mais le plugin `apps/web/plugins/auth.client.ts` qui appelle `refreshTokens()` quand Nuxt boote dans la popup `/auth/callback`. Le cookie refresh vient d'etre pose -> rotation immediate -> 2e ligne. Fix : skip `refreshTokens()` quand `window.location.pathname === '/auth/callback'`, la page gere sa propre session via le token query string.

**#36 OAuth callback URL publique** -- Separation de `API_BASE_URL` (interne, service-to-service en Docker) et `OAUTH_CALLBACK_BASE_URL` (publique, joignable par le browser). `buildCallbackUrl` lit la nouvelle var en priorite avec fallback sur `API_BASE_URL` puis localhost. `docker-compose.yml` et `.env.example` mis a jour. OAuth fonctionne maintenant depuis la stack Docker remote sans override.

**Tests** -- 29/29 API + 52/52 web vert sur la branche. Aucune regression detectee.

---

## 29 mai 2026

**Roadmap MVP + milestone GitHub** -- Création du plan MVP partagé avec Loreleï : doc canonical `docs/roadmap-mvp.md` + milestone GitHub #1 (échéance 26 juin 2026). 6 lots de #53 à #58 (lier Steam, import biblio, IGDB, biblio+fiche, statuts, reco IA), chaque issue avec la part back et front.

**Archi reco décidée** -- Backbone algorithmique, pas LLM pilote : profil de goût (vecteur pondéré par heures jouées x statut) + scoring additif sur candidats IGDB réels. Qwen3 14B local (RTX 5070) en re-ranker/explicateur ancré sur la liste fournie = zéro hallucination, coût zéro, argument RGPD. Embeddings reportés post-MVP mais scoring conçu modulaire pour les brancher sans dette.

**Sources de données** -- IGDB primaire (choisi pour `similar_games`, taxonomie structurée, mapping appid Steam). Signal qualité reco = IGDB `rating` (note joueurs) uniquement, pas la presse, avec seuil de votes. Metacritic écarté (pas d'API publique pour le score joueurs), RAWG en complément post-MVP. Succès Steam sortis du MVP.
