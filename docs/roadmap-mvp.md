# Roadmap MVP - NextQuest

**Échéance : 26 juin 2026** - MVP livré (6/6 lots, [Milestone MVP](https://github.com/nextquest-team/NextQuest/milestone/1) fermée), finitions reco jusqu'au 22 juillet 2026
Mise à jour : 25 septembre 2026

Ce document est le plan canonical du MVP. Chaque lot correspond à une issue GitHub rattachée à la milestone MVP. On coche au fur et à mesure ; une PR qui ferme une issue = un lot livré. Loreleï (front) et JB (back) y suivent l'avancement de chacun.

## Objectif MVP

Permettre à un joueur d'importer sa bibliothèque Steam (jeux + heures de jeu), de parcourir et gérer sa collection (statuts), et de recevoir des recommandations de jeux personnalisées via un moteur algorithmique, ajustées au fil de ses retours (swipe oui/non façon Tinder).

## Lots

Ordre d'implémentation (dépendances en cascade). Back = Jean-Baptiste, Front = Loreleï.

### Fait

- [x] **Auth** (email + OAuth Google/Microsoft, sessions) - JB
- [x] **Profil + onboarding** ([PR #51](https://github.com/nextquest-team/NextQuest/pull/51)) - JB

- [x] **1. Lier compte Steam** ([#53](https://github.com/nextquest-team/NextQuest/issues/53))
  - [x] Back : flux OpenID Steam, stockage SteamID dans `connected_services` ([PR #61](https://github.com/nextquest-team/NextQuest/pull/61)) - JB
  - [x] Front : bouton Connecter Steam + état connecté/déconnecté - Loreleï

- [x] **2. Import bibliothèque Steam (jeux + heures)** ([#54](https://github.com/nextquest-team/NextQuest/issues/54))
  - [x] Back : GetOwnedGames -> upsert `games` / `user_games` avec heures jouées ([PR #61](https://github.com/nextquest-team/NextQuest/pull/61)) - JB
  - [x] Front : feedback d'import - Loreleï
  - [x] Auto-import à la première liaison + modale de progression ([PR #102](https://github.com/nextquest-team/NextQuest/pull/102))

- [x] **3. Intégration IGDB (métadonnées + note joueurs)** ([#55](https://github.com/nextquest-team/NextQuest/issues/55), [PR #73](https://github.com/nextquest-team/NextQuest/pull/73), routes découverte [PR #83](https://github.com/nextquest-team/NextQuest/pull/83))
  - Client IGDB (auth Twitch), mapping appid Steam, enrichissement `games`, note joueurs `rating`, cache dans notre table `games`

- [x] **4. Bibliothèque + fiche jeu** ([#56](https://github.com/nextquest-team/NextQuest/issues/56), front [PR #81](https://github.com/nextquest-team/NextQuest/pull/81))
  - Liste collection (pagination, recherche, tri, filtres), fiche détail, split mobile/desktop

- [x] **5. Gestion statut jeu** ([#57](https://github.com/nextquest-team/NextQuest/issues/57), [PR #74](https://github.com/nextquest-team/NextQuest/pull/74))
  - Endpoints statut + historique `user_game_status_history`, auto-classification à l'import Steam, UI statut dans la biblio et la fiche

- [x] **6. Recommandations (profil de goût + scoring + swipe)** ([#58](https://github.com/nextquest-team/NextQuest/issues/58))
  - Back : 3 buckets, scoring additif, swipe ([PR #80](https://github.com/nextquest-team/NextQuest/pull/80)), refresh ([PR #86](https://github.com/nextquest-team/NextQuest/pull/86)), qualité & non-répétition ([PR #88](https://github.com/nextquest-team/NextQuest/pull/88), [PR #106](https://github.com/nextquest-team/NextQuest/pull/106)) - JB
  - Front : écran Next Quest ([PR #85](https://github.com/nextquest-team/NextQuest/pull/85), [PR #98](https://github.com/nextquest-team/NextQuest/pull/98), [PR #104](https://github.com/nextquest-team/NextQuest/pull/104)) - Loreleï
  - Re-ranker LLM abandonné le 20 juillet 2026 (voir Décisions clés)

## Livré après le MVP

- [x] Ajout manuel de jeux via IGDB + jeux ignorés ([PR #102](https://github.com/nextquest-team/NextQuest/pull/102))
- [x] Accessibilité WCAG + CI e2e ([PR #103](https://github.com/nextquest-team/NextQuest/pull/103))
- [x] Timeline des sorties : suivi, genres, précision des dates, refresh quotidien ([PR #112](https://github.com/nextquest-team/NextQuest/pull/112), [PR #107](https://github.com/nextquest-team/NextQuest/pull/107), [PR #115](https://github.com/nextquest-team/NextQuest/pull/115))
- [x] Filtre multi-plateforme, tri, badge plateforme ([PR #111](https://github.com/nextquest-team/NextQuest/pull/111))
- [x] Profil étendu + upload d'avatar MinIO/S3 ([PR #116](https://github.com/nextquest-team/NextQuest/pull/116))
- [ ] Page profil front (carnet mobile, avatar dynamique, avatar par défaut généré) - branche `feat/profil-page`, PR à ouvrir - Loreleï

## Reste à faire (post-MVP)

- App mobile Expo (toujours au stade du scaffold `App.tsx`)
- Succès Steam (`external_achievements`)
- Embeddings sémantiques (pgvector) comme 2e signal de scoring reco
- RAWG en complément (autres données)
- Social (amis, messages, conversations)
- Notifications + préférences
- Badges
- Autres plateformes : PSN, Xbox, Nintendo, Epic

## Décisions clés

- **Reco = moteur algorithmique uniquement, LLM abandonné** (20 juillet 2026). Le re-ranker/explicateur Qwen local sort du périmètre, y compris en post-MVP : le moteur (similarité de contenu genres/thèmes/studio, cap de diversité, non-répétition, découverte multi-source) couvre le besoin, reste explicable au jury, déterministe donc testable, et ne dépend pas d'un LLM non déployable.
- ~~**Reco = backbone algorithmique, LLM juge/explique par-dessus**~~ (29 mai 2026, remplacé par la décision ci-dessus).
- **Scoring additif dès le MVP.** Le score est une somme de signaux, conçu modulaire pour brancher l'embedding (phase 2) sans réarchitecturer.
- **Signal qualité = IGDB `rating` (note joueurs), pas la presse.** Avec un seuil de votes minimum et un plancher pour ne pas recommander de jeux mal notés. Metacritic écarté (pas d'API publique pour le score joueurs) ; le champ `metacritic` de RAWG est une note presse, non retenue.
- **IGDB = base de jeux primaire.** Choisi pour `similar_games` (alimente la reco), sa taxonomie structurée (genres/thèmes/tags) et le mapping appid Steam. RAWG en complément optionnel post-MVP.
- ~~**IA locale Qwen3 14B**~~ : caduque depuis l'abandon du LLM.
- **Succès Steam sortis du MVP** (décision du 29 mai 2026).
