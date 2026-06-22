# Fiche révision — Jury blanc NextQuest

> Lecture mobile, 5 minutes pour relire avant l'oral.
> Format : pitch / slide-par-slide / glossaire / Q&R.

---

## Pitch ultra-court (30 s, si on me coupe)

> "NextQuest, c'est l'app qui centralise tes jeux de Steam, PlayStation, Xbox, Switch, et qui te dit à quoi jouer ce soir grâce à une IA locale. On y suit sa progression, on anticipe les sorties, on partage avec ses amis. Backend Node.js + Fastify + PostgreSQL, front Vue/Nuxt et React Native, IA Qwen 3 en local pour la reco. MVP juin 2026, soutenance CDA juillet 2027."

---

## Slide par slide — ce que je dis

### Slide 1 — Cover (40 s)
"Bonjour, je suis Jean-Baptiste. Je vais vous parler de NextQuest, l'app qu'on développe avec Loreleï pour notre certif CDA. Avant de vous montrer ce qu'on construit, laissez-moi vous raconter pourquoi."

### Slide 2 — Hook perso (1 min)
"Voici ma situation. J'ai des jeux partout. 5 endroits différents pour voir mes bibliothèques. La vraie question c'est pas combien j'en ai. C'est : où j'en suis dans Hollow Knight que j'ai lancé il y a 3 mois ? Est-ce que j'ai fini Zelda ? Et samedi soir quand j'ai 2 heures devant moi, à quoi je joue ?"

### Slide 3 — Problème (1.5 min)
"Et je suis loin d'être seul. La majorité des gamers PC jonglent avec plusieurs launchers. Le 'pile of shame' c'est un meme universel. Pendant ce temps il sort 14 000 jeux par an, on en rate forcément. Personne n'a d'outil unifié. Steam ignore ta PS5. La PS5 ignore ta Switch. Chaque plateforme se fiche des autres."

### Slide 4 — Solution (3 min)
"NextQuest, c'est un carnet de quêtes vidéoludiques. Quatre fonctions :
- **Centraliser** : tu connectes ton compte Steam, ton PSN, ton Xbox, etc., et NextQuest récupère automatiquement ta bibliothèque depuis chaque plateforme.
- **Suivre** : pour chaque jeu, tu dis où tu en es : à faire, en cours, terminé, abandonné. Tu peux noter, taguer.
- **Anticiper** : une timeline des sorties à venir sur toutes les plateformes. Tu rates plus une release.
- **Recommander** : c'est là qu'on va plus loin. Une IA locale qui te dit, en fonction de tes habitudes et du temps que tu as, à quoi jouer ce soir.

Loreleï a créé tout cet univers brodé, comme un carnet d'aventurier manuscrit. Très éloigné des UI gaming agressives habituelles."

### Slide 5 — Équipe (45 s)
"On est 2. Loreleï est notre designer et développeuse front, elle gère toute la DA et l'intégration en Vue/Nuxt. Moi je m'occupe du backend, de l'archi et de l'infrastructure. On bosse en feature branches, PRs mutuellement reviewées. Comme une vraie équipe pro. Aujourd'hui je présente seul puisque c'est un oral individuel, mais NextQuest c'est notre projet à 2."

### Slide 6 — Stack (1.5 min)
"Voilà l'archi globale. Côté client deux apps : web en Nuxt, mobile en React Native. Les deux tapent une seule API Node.js avec Fastify. Derrière, PostgreSQL pour la donnée, Redis pour le cache et les sessions. On parle aux APIs gaming pour importer les bibliothèques, et à une IA locale Qwen 3 pour les recommandations.

Côté infra dev : Docker Compose qui tourne sur un PC distant, accédé depuis le Mac via VPN privé Tailscale. Environnement isolé et reproductible, et Loreleï bosse sur les mêmes données que moi."

### Slide 7 — Choix défendus (3 min, 1 min par choix)
"Trois choix qu'on défend :

- **Vue/Nuxt 3 plutôt que React/Next.js** : Loreleï maîtrise Vue car c'est ce qui est enseigné chez ForEach. Nuxt 3, c'est Vue full-stack, avec rendu serveur et un écosystème mature. On code moins, on livre plus vite.

- **React Native + Expo plutôt que Flutter** : on garde un écosystème JavaScript unifié avec le web. Même langage, types et validations partagés entre web et mobile. Expo simplifie le build, l'OTA et les permissions natives.

- **PostgreSQL plutôt que MongoDB** : nos données sont fondamentalement relationnelles (users, jeux, statuts, amis). Postgres garantit l'intégrité référentielle, les transactions ACID, et offre du JSONB quand on a besoin de flexibilité ponctuelle."

### Slide 8 — Sécurité & qualité (2 min)
"On a pris la sécurité au sérieux dès le départ.

- Schéma BDD audité contre l'OWASP Top 10, les 10 vulnérabilités web les plus critiques.
- Conformité RGPD : la suppression d'un compte purge automatiquement toutes les données personnelles via les cascades SQL. Droit à l'effacement intégré au niveau de la base.
- Auth durcie avec Argon2id, le hashage référence du NIST en 2026, plus une rotation des tokens JWT avec détection de vol.
- CI/CD industrialisée : GitHub Actions qui lance lint, typecheck, tests, build et audit sécurité à chaque push. CodeQL et Dependabot qui surveillent en continu. 32 vulnérabilités résolues à date."

### Slide 9 — État (1.5 min)
"Concrètement, ce qui tourne aujourd'hui :
- 34 tables PostgreSQL, schéma audité OWASP/RGPD/NIST.
- Module d'authentification complet : email/mot de passe, OAuth Google et Microsoft. Apple est prêt à brancher.
- CI/CD opérationnelle, branche develop protégée.
- Documentation API auto-générée avec Swagger sur /docs. Loreleï peut explorer en autonomie.
- Module Users en cours cette semaine : profil, onboarding, settings.
- Maquette mobile V2 que Loreleï finalise en parallèle.
- 23 tests d'intégration verrouillent les comportements critiques."

### Slide 10 — Roadmap (1 min)
"La suite :
- Mai-Juin : import Steam et autres plateformes.
- Juin 2026 : MVP fonctionnel — IA reco, APIs jeux et timeline des sorties.
- Automne 2026 : social et partage.
- 2027 : scraping et IA d'analyse pour les dates de sorties (parce que toutes les plateformes ne donnent pas ça en API).
- Juillet 2027 : soutenance officielle CDA.

Plateformes : Steam d'abord car elle a une API publique. Puis PSN, Xbox, GOG, Epic, Ubisoft, EA. Nintendo en dernier — pas d'API officielle, c'est le boss final."

### Slide 11 — Fin (15 s)
"Voilà NextQuest. Place à vos questions."

---

## Glossaire éclair (les termes que je dis)

### Front-end / web

- **Vue.js** — Framework JavaScript pour construire des interfaces. Concurrent de React. Plus simple à apprendre, syntaxe plus proche du HTML.
- **Nuxt 3** — Le "Next.js du monde Vue". Framework qui ajoute le rendu côté serveur (SSR), le routage, et tout ce qu'il faut pour une vraie app web full-stack en Vue.
- **SSR (Server-Side Rendering)** — Le HTML est généré sur le serveur avant d'être envoyé au navigateur. Avantages : SEO, première peinture rapide, accessibilité. Sans SSR, le navigateur reçoit une page vide et doit tout construire en JS.
- **React Native** — Framework de Facebook qui permet d'écrire une app mobile en JavaScript/React, qui tourne en natif sur iOS et Android. Pas du web mobile, vraiment du natif.
- **Expo** — Surcouche de React Native qui simplifie le build, les permissions natives, les notifications, et permet d'envoyer des mises à jour OTA (over-the-air) sans repasser par les stores.
- **Flutter** — Concurrent de React Native, par Google, langage Dart. Très bon mais ça nous obligeait à apprendre un nouveau langage et à dupliquer la logique métier qu'on a déjà en JS.

### Back-end / API

- **Node.js** — Runtime JavaScript côté serveur. Au lieu de tourner dans le navigateur, le JS tourne sur la machine.
- **Fastify** — Framework web Node.js. Concurrent d'Express. ~2× plus rapide qu'Express, validation built-in, plugin system moderne, schémas JSON pour valider les requêtes.
- **Express** — Le standard historique pour les API Node.js. Fonctionne mais date un peu, écosystème vieillissant.
- **Drizzle** — ORM TypeScript "SQL-first". Tu écris du SQL avec un wrapper typé. Pas de magie cachée, tu vois la requête générée. Très rapide, très léger.
- **ORM (Object-Relational Mapping)** — Une couche qui traduit ton code en requêtes SQL. Au lieu d'écrire du SQL à la main, tu manipules des objets typés.
- **Prisma** — ORM concurrent de Drizzle. Très populaire mais plus lourd, génère un gros client, plus de magie, performances moins bonnes.
- **Zod** — Bibliothèque de validation de données en TypeScript. On définit le format attendu d'une requête (genre "doit avoir un email valide et un mot de passe de 8 caractères mini") et Zod valide à l'entrée. Bonus : on peut partager les mêmes validations entre front et back.

### Base de données

- **PostgreSQL** — Base de données relationnelle open-source. Référence du marché. Très robuste, ACID, supporte JSON, full-text search, etc.
- **MongoDB** — Base de données NoSQL "documents". Stocke du JSON. Plus souple sur le schéma mais perd l'intégrité référentielle automatique.
- **Relationnel vs NoSQL** — Relationnel = tables avec des lignes et des relations (clés étrangères) entre elles. NoSQL = documents libres. Pour NextQuest les données sont fortement liées (un user a plein de jeux, chaque jeu a un statut, des amis, etc.) donc relationnel s'impose.
- **ACID** — 4 garanties d'une transaction : Atomicité (tout ou rien), Cohérence (l'état reste valide), Isolation (transactions concurrentes ne se marchent pas dessus), Durabilité (une fois commité, c'est gravé). Postgres respecte ACID, MongoDB fait des compromis.
- **JSONB** — Type Postgres pour stocker du JSON binaire. On garde la flexibilité du NoSQL pour les champs vraiment non-structurés, sans changer de base.
- **Cascades SQL (ON DELETE CASCADE)** — Quand on supprime un user, toutes les lignes liées (jeux, statuts, amis…) sont supprimées automatiquement par la base. Critique pour le RGPD.
- **Migrations** — Fichiers SQL qui décrivent l'évolution du schéma de la base au fil du temps. Drizzle les génère depuis nos fichiers TypeScript.

### Cache, infra

- **Redis 7** — Base clé-valeur en mémoire. Ultra rapide. On s'en sert pour les sessions, le cache de requêtes, le rate limiting.
- **Docker** — Conteneurise une appli avec sa config. "Ça marche chez moi" devient "ça marche partout pareil". On lance Postgres + Redis dans des containers Docker.
- **Docker Compose** — Outil pour orchestrer plusieurs containers (Postgres + Redis ensemble) avec un seul fichier de config.
- **Tailscale** — VPN moderne basé sur WireGuard. Crée un réseau privé entre tes machines, peu importe où elles sont. Notre PC distant à la maison est joignable depuis le Mac via Tailscale, sans ouvrir de port.
- **VPN** — Virtual Private Network. Un tunnel chiffré entre deux machines.

### IA / scraping

- **Qwen 3** — LLM open-source d'Alibaba. Concurrent de Llama (Meta) ou Mistral. Bon rapport perf/coût pour tourner en local.
- **Ollama** — Outil pour faire tourner facilement des LLMs en local sur sa machine. Equivalent d'un Docker pour modèles d'IA. On lance `ollama run qwen3` et c'est dispo en API locale.
- **LLM (Large Language Model)** — Grand modèle de langage. ChatGPT, Claude, Qwen, Llama, etc.
- **Local vs cloud** — Local = ça tourne chez nous, gratuit après l'install, données restent privées. Cloud = on envoie chaque requête à OpenAI/Anthropic, payant à l'usage, données sortent.
- **Scraping** — Récupérer automatiquement de la donnée depuis un site web qui n'a pas d'API. On parse le HTML.
- **IA d'analyse** — Pour les dates de sorties (slide 10), on prévoit de scraper des sites de news gaming et de faire passer le contenu à un LLM pour qu'il extraie les dates de sortie de manière structurée.

### Auth & sécurité

- **OAuth** — Protocole pour se connecter via un autre service. "Se connecter avec Google" = OAuth.
- **JWT (JSON Web Token)** — Token signé qui prouve qu'on est connecté. Le serveur le donne au login, le client l'envoie à chaque requête.
- **Refresh token** — Token longue durée qui sert à obtenir un nouveau JWT (qui lui est court, 15 min chez nous). Permet de rester connecté sans avoir à se relogger.
- **Rotation des refresh tokens** — À chaque refresh, on invalide l'ancien token et on en émet un nouveau. Si quelqu'un vole un ancien token, il est déjà mort.
- **Détection de vol de refresh token** — Si l'ancien token est utilisé après rotation, c'est qu'il a été volé. On invalide toute la chaîne et on déconnecte.
- **Argon2id** — Algorithme de hashage des mots de passe. Référence NIST 2026. Successeur de bcrypt. Très résistant aux attaques GPU.
- **Hashage** — Transformer un mot de passe en empreinte qu'on ne peut pas inverser. On stocke l'empreinte, jamais le mot de passe en clair.
- **OWASP Top 10** — Liste des 10 vulnérabilités web les plus critiques publiée par la fondation OWASP. Référence en sécurité applicative.
- **RGPD** — Règlement Général sur la Protection des Données. Loi européenne. Impose entre autres le droit à l'effacement (un user peut tout supprimer).
- **NIST** — Agence US de standardisation. Référence pour les normes de cryptographie et de sécurité.
- **Rate limiting** — Limiter le nombre de requêtes qu'un client peut faire en X temps. Empêche le brute-force et le spam. Chez nous : 5 inscriptions par 15 min, 10 logins par minute, etc.

### Qualité / DevOps

- **CI/CD (Continuous Integration / Continuous Deployment)** — À chaque push de code, un robot lance automatiquement : lint, typecheck, tests, build, audit sécurité. Si quelque chose pète, le merge est bloqué. Ça empêche les bugs de partir en prod.
- **GitHub Actions** — Service de CI/CD intégré à GitHub. On écrit nos workflows en YAML.
- **CodeQL** — Outil d'analyse statique de GitHub qui détecte les vulnérabilités dans le code source.
- **Dependabot** — Bot GitHub qui surveille les dépendances et ouvre des PR pour les mettre à jour quand une vulnérabilité est publiée.
- **Lint** — Vérifier le style du code (indentation, conventions). On utilise ESLint.
- **Typecheck** — Vérifier que les types TypeScript sont cohérents. Détecte plein de bugs avant l'exécution.
- **Branch protection** — Sur GitHub, règles qui empêchent de pousser n'importe quoi sur develop/main. Chez nous : 1 review obligatoire, CI verte, linear history.
- **Tests d'intégration** — Tests qui exercent l'API contre une vraie base de données. Plus lourds que les unitaires mais valident le comportement bout-en-bout.
- **Swagger / OpenAPI** — Standard pour décrire une API HTTP. Permet de générer une doc interactive testable dans le navigateur (chez nous sur `/docs`).

### Architecture / projet

- **Monorepo** — Un seul repo Git qui contient plusieurs apps et packages. Chez nous : `apps/api`, `apps/web`, `apps/mobile`, `packages/shared`, etc. Plus simple à gérer que 5 repos séparés.
- **pnpm** — Gestionnaire de packages alternatif à npm/yarn. Plus rapide, plus économe en disque, supporte nativement les workspaces (monorepo).
- **Turborepo** — Outil pour orchestrer les tasks dans un monorepo. Sait quoi rebuild quand on touche à quoi, parallélise les builds.
- **Workspace** — Dans un monorepo, un sous-projet (app ou package) qui peut référencer d'autres workspaces du même repo.

---

## Tableau des choix techniques

| Notre choix | Plutôt que | Raison principale |
|---|---|---|
| **Vue/Nuxt 3** | React/Next.js | Loreleï maîtrise Vue (formation ForEach) |
| **React Native + Expo** | Flutter | Écosystème JS unifié avec le web, types partagés |
| **Fastify 5** | Express | 2× plus rapide, validation built-in, écosystème moderne |
| **Drizzle** | Prisma | SQL transparent, pas de client géant, migrations propres |
| **PostgreSQL** | MongoDB | Données relationnelles, ACID, intégrité référentielle |
| **Redis 7** | (rien) | Cache + sessions + rate limit en mémoire = ultra rapide |
| **Zod** | class-validator | Inférence TS, validations partagées front/back |
| **Qwen 3 local (Ollama)** | OpenAI/Claude API | Coût zéro, données privées, souveraineté |
| **Argon2id** | bcrypt | Référence NIST 2026, résiste mieux aux GPU |
| **pnpm + Turborepo** | npm + 3 repos séparés | Workspaces, builds parallèles, partage de code |

---

## Q&R préparées

**Q : Pourquoi pas un BaaS type Supabase ou Firebase ?**
R : On veut maîtriser notre stack pour le CDA — c'est l'objectif de la certif. Supabase c'est super pour aller vite, mais on y apprend moins. Et on a un module IA local qu'on n'aurait pas pu placer aussi simplement.

**Q : Pourquoi pas un seul gros framework type Laravel ou Django ?**
R : Pareil, on voulait montrer qu'on maîtrise les blocs séparément. Et le monde JS nous permet de partager les types et les validations entre web, mobile et back, ce qu'aucun framework PHP ou Python ne permet.

**Q : Le RGPD, c'est juste une promesse ou c'est implémenté ?**
R : C'est implémenté au niveau de la base. Toute clé étrangère vers `users.id` a un comportement `ON DELETE` défini. Par défaut CASCADE : si on supprime un user, toutes ses données sont purgées par la base sans intervention applicative. Exception documentée : l'audit log qui passe en SET NULL pour garder la trace de l'événement sans la donnée perso.

**Q : Comment tu protèges contre le vol de mot de passe en BDD ?**
R : Argon2id avec un sel unique par mot de passe. Même si on volait la base, l'attaquant ne pourrait pas remonter aux mots de passe en clair sans GPU et beaucoup de temps. Argon2id est précisément conçu pour résister aux attaques GPU.

**Q : Pourquoi un VPN privé pour le dev ? C'est pas overkill ?**
R : C'est juste pratique. Le PC qui héberge Postgres et Redis est chez moi à la maison. Tailscale permet de le joindre depuis n'importe où sans ouvrir de port sur le routeur. Loreleï peut bosser depuis chez elle sur la même base que moi. Et c'est aussi un bon entraînement aux pratiques pro.

**Q : Et la maintenance long terme du LLM local ?**
R : Pendant le dev et le MVP on tourne sur Qwen 3 en local. Quand on scale, on migrera sur un modèle plus gros, soit en self-host sur un serveur GPU, soit en cloud. Le code est isolé derrière une interface, on switche le provider en changeant un fichier.

**Q : Comment tu gères les rate limits des APIs externes (Steam, IGDB…) ?**
R : Côté Steam, l'API est limitée à environ 100k req/jour. On cache agressivement dans Redis (les bibliothèques ne changent pas toutes les minutes), on synchronise par batch, et on respecte les headers de rate limiting. Idem pour IGDB et RAWG.

**Q : Pourquoi avoir séparé `auth_providers` et `connected_services` dans la BDD ?**
R : Parce qu'ils répondent à des besoins différents. `auth_providers` (Google, Microsoft, Discord) = pour s'identifier sur NextQuest. `connected_services` (Steam, PSN, Xbox) = pour importer la bibliothèque gaming. Un user peut se connecter via Google et avoir Steam comme source de jeux. Mélanger les deux aurait été source de bugs et d'incompréhensions.

**Q : C'est quoi la différence entre Nuxt et juste Vue ?**
R : Vue tout seul fait tourner une SPA (single-page app) côté navigateur. Nuxt ajoute le rendu serveur (SSR), le routage automatique, le système de modules, les middlewares. Pour une vraie app full-stack, c'est nécessaire.

**Q : Pourquoi pas du TypeScript côté API directement avec Hono ou tRPC ?**
R : Fastify a la maturité, Drizzle a la lisibilité, Zod a la validation. Le combo nous donne la performance d'Hono avec la robustesse d'un framework éprouvé. tRPC est cool mais on voulait une API REST classique, plus facile à documenter et à consommer depuis n'importe quel client.

---

## Mémo timing

| Section | Min | Max |
|---|---|---|
| Cover + hook + problème | 3 min | 4 min |
| Solution + équipe | 4 min | 5 min |
| Stack + choix défendus | 4 min | 5 min |
| Sécu + état + roadmap | 4 min | 5 min |
| Fin + buffer questions | 1 min | 1 min |
| **Total** | **16 min** | **20 min** |

---

## Tips oral

- Respire entre les slides. Une seconde de silence = 0 problème.
- Si on me coupe, je pivote sur le pitch 30 s.
- Sur les choix tech, je garde **une raison principale** par tech. Si la prof creuse, j'ai le détail dans le glossaire.
- Pour les termes très techniques (ACID, Argon2id, JWT…) je les *prononce vite*, et j'explique en français juste après. Genre : "JWT, c'est un jeton signé qui prouve qu'on est connecté."
- Si je sais pas : "Bonne question, je n'ai pas la réponse précise, je creuse pour la prochaine."
