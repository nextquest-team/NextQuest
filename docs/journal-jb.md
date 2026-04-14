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
