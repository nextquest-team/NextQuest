# Roadmap MVP - NextQuest

**Échéance : 26 juin 2026**
Suivi live : [Milestone MVP](https://github.com/nextquest-team/NextQuest/milestone/1)

Ce document est le plan canonical du MVP. Chaque lot correspond à une issue GitHub rattachée à la milestone MVP. On coche au fur et à mesure ; une PR qui ferme une issue = un lot livré. Loreleï (front) et JB (back) y suivent l'avancement de chacun.

## Objectif MVP

Permettre à un joueur d'importer sa bibliothèque Steam (jeux + heures de jeu), de parcourir et gérer sa collection (statuts), et de recevoir des recommandations de jeux personnalisées via une IA locale, ajustées au fil de ses retours (swipe oui/non façon Tinder).

## Lots

Ordre d'implémentation (dépendances en cascade). Back = Jean-Baptiste, Front = Loreleï.

### Fait

- [x] **Auth** (email + OAuth Google/Microsoft, sessions) - JB
- [x] **Profil + onboarding** ([PR #51](https://github.com/nextquest-team/NextQuest/pull/51)) - JB

### À faire

- [ ] **1. Lier compte Steam** ([#53](https://github.com/nextquest-team/NextQuest/issues/53))
  - Back : flux OpenID Steam, stockage SteamID dans `connected_services`
  - Front : bouton Connecter Steam + état connecté/déconnecté

- [ ] **2. Import bibliothèque Steam (jeux + heures)** ([#54](https://github.com/nextquest-team/NextQuest/issues/54)) - dépend de 1
  - Back : GetOwnedGames -> upsert `games` / `user_games` avec heures jouées
  - Front : feedback d'import

- [ ] **3. Intégration IGDB (métadonnées + note joueurs)** ([#55](https://github.com/nextquest-team/NextQuest/issues/55))
  - Back : client IGDB (auth Twitch), mapping appid Steam, enrichissement `games` (genres, thèmes, tags, jaquette, `similar_games`), note joueurs `rating` uniquement
  - Hydratation en cache dans notre table `games` (IGDB pas interrogé en live)

- [ ] **4. Bibliothèque + fiche jeu** ([#56](https://github.com/nextquest-team/NextQuest/issues/56)) - dépend de 2, 3
  - Back : endpoint liste collection (pagination, recherche, tri) + endpoint détail jeu
  - Front : grille/liste avec jaquettes, recherche/filtres, clic -> fiche complète

- [ ] **5. Gestion statut jeu** ([#57](https://github.com/nextquest-team/NextQuest/issues/57)) - dépend de 2
  - Back : endpoints statut (à faire / en cours / terminé / abandonné), historique `user_game_status_history`
  - Front : UI statut (badges/dropdown) + filtres, dans la biblio et la fiche

- [ ] **6. Reco IA (profil de goût + scoring + swipe)** ([#58](https://github.com/nextquest-team/NextQuest/issues/58)) - dépend de 2, 3
  - Feature critique. Spec dédiée à brainstormer avant de coder.
  - Back : profil de goût (vecteur pondéré par heures x statut), candidats IGDB, scoring additif, swipe-learning en BDD, Qwen3 14B local en re-ranker/explicateur
  - Front : écran swipe + affichage du "pourquoi"

## Hors MVP (post-MVP)

- Succès Steam (`external_achievements`)
- Embeddings sémantiques (pgvector) comme 2e signal de scoring reco
- RAWG en complément (autres données)
- Social (amis, messages, conversations)
- Notifications + préférences
- Badges
- Timeline des sorties
- Ajout manuel de jeux
- Autres plateformes : PSN, Xbox, Nintendo, Epic

## Décisions clés

- **Reco = backbone algorithmique, pas LLM pilote.** Un LLM seul hallucine et n'est pas ancré dans le catalogue IGDB. L'algo génère les candidats réels ; Qwen juge/explique par-dessus. (Brainstorm du 29 mai 2026.)
- **Scoring additif dès le MVP.** Le score est une somme de signaux : un seul au MVP, conçu modulaire pour brancher l'embedding (phase 2) sans réarchitecturer.
- **Signal qualité = IGDB `rating` (note joueurs), pas la presse.** Avec un seuil de votes minimum et un plancher pour ne pas recommander de jeux mal notés. Metacritic écarté (pas d'API publique pour le score joueurs) ; le champ `metacritic` de RAWG est une note presse, non retenue.
- **IGDB = base de jeux primaire.** Choisi pour `similar_games` (alimente la reco), sa taxonomie structurée (genres/thèmes/tags) et le mapping appid Steam. RAWG en complément optionnel post-MVP.
- **IA locale Qwen3 14B** (RTX 5070, 12 Go VRAM) plutôt qu'une API payante : suffisant pour re-rank + explication, coût zéro, argument RGPD (données ne sortent pas vers un tiers), recos précalculables en batch (PC allumé au calcul, pas à la démo).
- **Succès Steam sortis du MVP** (décision du 29 mai 2026).
