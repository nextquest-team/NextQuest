# NextQuest.io - Architecture du Projet

## Vue d'ensemble

Application web et mobile de gestion de ludothèque vidéoludique permettant aux joueurs de centraliser leur collection depuis plusieurs plateformes, suivre leur progression, et recevoir des recommandations personnalisées.

## Stack Technique

### Frontend

| Application | Technologie | Description |
|------------|-------------|-------------|
| Web | Next.js 14+ (App Router) | SSR, React Server Components |
| Mobile | React Native + Expo | Cross-platform iOS/Android |
| UI | Tailwind CSS + shadcn/ui | Design system unifié |

### Backend

| Composant | Technologie | Description |
|-----------|-------------|-------------|
| BDD | Supabase (PostgreSQL) | Base de données principale |
| Auth | Supabase Auth | OAuth + email/password |
| Cache | Redis (Upstash) | Cache API, sessions |
| Realtime | Supabase Realtime | Messagerie, statuts en ligne |
| Storage | Supabase Storage | Images custom games |
| Edge Functions | Supabase Edge Functions | Webhooks, crons, notifications |

### Services externes

| Service | Usage |
|---------|-------|
| Steam API | Import bibliothèque, temps de jeu, succès |
| PlayStation API | Import bibliothèque PSN, trophées |
| Xbox API | Import bibliothèque Xbox, gamerscore |
| IGDB API | Métadonnées jeux, dates de sortie |
| RAWG API | Données complémentaires, notes |
| Firebase Cloud Messaging | Push notifications |
| Resend / SendGrid | Emails transactionnels |

### IA / ML

| Composant | Technologie | Description |
|-----------|-------------|-------------|
| Recommandations | Python + scikit-learn | Filtrage collaboratif |
| Scraping sorties | Python + BeautifulSoup | Détection changements dates |
| Hébergement ML | Railway / Render | API microservice |

## Structure Monorepo

```
nextquest/
├── apps/
│   ├── web/                    # Application Next.js
│   │   ├── app/                # App Router
│   │   ├── components/         # Composants React
│   │   ├── lib/                # Utils, hooks
│   │   └── styles/             # CSS global
│   ├── mobile/                 # Application React Native
│   │   ├── app/                # Expo Router
│   │   ├── components/         # Composants RN
│   │   └── lib/                # Utils, hooks
│   └── api/                    # Edge Functions Supabase
│       ├── functions/          # Fonctions serverless
│       └── crons/              # Jobs planifiés
├── packages/
│   ├── shared/                 # Code partagé
│   │   ├── types/              # Types TypeScript
│   │   ├── validators/         # Zod schemas
│   │   └── utils/              # Fonctions utilitaires
│   ├── ui/                     # Composants UI partagés
│   │   └── src/                # Composants React/RN
│   └── database/               # Supabase
│       ├── migrations/         # Migrations SQL
│       ├── seeds/              # Données de test
│       └── types/              # Types générés
├── services/
│   └── ai/                     # Microservice ML
│       ├── recommender/        # Moteur de recommandations
│       └── scraper/            # Scraper dates de sortie
├── docs/
│   ├── plans/                  # Documents d'architecture
│   └── database/               # Schémas BDD
├── turbo.json                  # Config Turborepo
├── pnpm-workspace.yaml         # Workspaces pnpm
├── package.json
└── README.md                   # Documentation projet
```

## Architecture Base de Données

### Schéma relationnel

Voir `docs/database/schema.dbml` pour le schéma complet.

### Entités principales

1. **Référentiels** : `platforms`, `services`, `genres`, `tags`
2. **Utilisateurs** : `users`, `connected_services`
3. **Jeux** : `games`, `game_platforms`, `game_genres`, `game_updates`
4. **Collection** : `user_games`, `user_game_tags`
5. **Achievements** : `external_achievements`, `badges`, `user_badges`
6. **Social** : `friendships`
7. **Messagerie** : `conversations`, `conversation_members`, `messages`
8. **Notifications** : `notifications`, `notification_preferences`
9. **Feed** : `activities`
10. **IA** : `recommendations`

### Stratégies clés

| Aspect | Stratégie |
|--------|-----------|
| Cache jeux | Stockage local + refresh intelligent basé sur l'ancienneté |
| Plateformes vs Services | Tables séparées (Steam ≠ PC) |
| Relations amis | Directionnelle (2 entrées par amitié acceptée) |
| Messagerie | Système de conversations (évolutif vers groupes) |
| Notifications | Rétention 90 jours pour les notifications lues |
| Wishlist | Statut dans `user_games` (pas de table séparée) |
| Jeux custom | Flag `is_custom` dans `games` |
| Feed | Fan-out on read (table `activities` centrale) |

## Flux de données

### Import bibliothèque

```
User connecte Steam → OAuth → Récupère access_token
                           → Stocke dans connected_services
                           → Job: Import games Steam API
                           → Pour chaque jeu:
                              → Cherche dans games (par igdb_id)
                              → Si pas trouvé: fetch IGDB + insert
                              → Insert user_games
                              → Insert external_achievements
```

### Recommandations IA

```
Cron quotidien → Pour chaque user actif:
              → Récupère user_games + ratings + tags
              → Envoie au service ML
              → ML calcule similarités
              → Retourne top 10 jeux
              → Insert/Update recommendations
              → (Optionnel) Notification push
```

### Détection changements dates

```
Cron quotidien → Scraper vérifie jeux upcoming
              → Compare avec games.release_date
              → Si changement:
                 → Insert game_updates
                 → Trouve users avec ce jeu en wishlist
                 → Crée notifications
                 → Envoie push/email selon prefs
```

## Sécurité

### Supabase RLS (Row Level Security)

```sql
-- Exemple: user_games visible uniquement par le propriétaire
CREATE POLICY "Users can view own games"
ON user_games FOR SELECT
USING (auth.uid() = user_id);

-- Exemple: profils publics visibles par tous
CREATE POLICY "Public profiles are viewable"
ON users FOR SELECT
USING (is_public = true OR auth.uid() = id);
```

### Chiffrement

- Tokens OAuth chiffrés en BDD (pgcrypto)
- HTTPS obligatoire
- JWT pour l'authentification API

## Conventions

### Code

- TypeScript strict partout
- ESLint + Prettier
- Conventional Commits
- Tests unitaires (Vitest) + E2E (Playwright)

### Git

- `main` : production
- `develop` : intégration
- `feature/*` : nouvelles fonctionnalités
- `fix/*` : corrections de bugs

### Branches

```
main ← develop ← feature/auth-steam
                ← feature/game-collection
                ← fix/notification-bug
```

## Déploiement

| Environnement | Service | URL |
|--------------|---------|-----|
| Web Prod | Vercel | nextquest.io |
| Web Preview | Vercel | *.vercel.app |
| Mobile | Expo EAS | App Store / Play Store |
| API | Supabase | *.supabase.co |
| ML | Railway | api-ml.nextquest.io |

## Planning

| Phase | Période | Focus |
|-------|---------|-------|
| Conception | Oct 2025 - Jan 2026 | CDC, maquettes, BDD |
| Backend | Fév 2026 - Mai 2026 | API, auth, imports |
| Frontend | Juin 2026 - Oct 2026 | Web + Mobile |
| IA | Nov 2026 - Fév 2027 | Recommandations |
| Tests | Mars 2027 - Mai 2027 | QA, polish |
| Soutenance | Juin - 16 Juillet 2027 | Présentation CDA |
