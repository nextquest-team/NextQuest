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
