# User stories — NextQuest

Ce document est le backlog produit de NextQuest, application web et mobile de gestion de ludothèque vidéoludique. Il décrit, du point de vue de l'utilisateur, tout ce que l'application doit permettre, y compris ce qui n'est pas encore développé.
Chaque story suit le même modèle : un rôle, un besoin, un bénéfice, puis des critères d'acceptation que l'on peut vérifier à la main. Priorité et état sont deux axes indépendants : une story peut être indispensable et pourtant à faire.
Les exigences transverses (accessibilité WCAG 2.1 AA, français et anglais, chargement de page inférieur à 3 secondes) s'appliquent à toutes les stories ; elles ne sont rappelées que lorsqu'un utilisateur les perçoit directement.

## Acteurs

- **Visiteur** : personne non connectée, qui découvre NextQuest et peut créer un compte ou se connecter.
- **Joueur connecté** : utilisateur authentifié qui gère sa ludothèque, suit sa progression et utilise les fonctions sociales.
- **Administrateur** : membre de l'équipe NextQuest qui entretient le catalogue de jeux et modère la communauté.

### Persona 1 : Maxime, 28 ans, le joueur occasionnel

Maxime est salarié et joue de 5 à 10 heures par semaine, le soir et le week-end, sur PS5 et Nintendo Switch.
Sa frustration : il a trop de jeux dans son backlog et ne sait jamais à quoi jouer.
Il attend de NextQuest des recommandations de jeux courts, adaptés à son temps libre.

### Persona 2 : Émilie, 24 ans, la joueuse passionnée et collectionneuse

Émilie est étudiante et joue plus de 30 heures par semaine, sur PC (Steam, Epic, GOG), PS5 et Xbox Series X.
Sa frustration : sa bibliothèque est éparpillée sur plus de cinq launchers et elle perd le fil de ses succès.
Elle attend de NextQuest une vue unifiée de tous ses jeux, des statistiques détaillées et le suivi des 100 %.

### Persona 3 : Lucas, 19 ans, le joueur social

Lucas est étudiant et joue surtout en multijoueur avec ses amis, sur PC (Steam) et Xbox Series S.
Sa frustration : il est difficile de savoir à quoi jouent ses amis et de trouver des jeux en commun.
Il attend de NextQuest de voir l'activité de ses amis, de partager ses découvertes et d'obtenir des recommandations communes.

| Persona | Épics qui le concernent le plus |
|---|---|
| Maxime, le joueur occasionnel | REC, TIM, ALE, STA |
| Émilie, la joueuse passionnée et collectionneuse | EXT, COL, PRO, STA |
| Lucas, le joueur social | SOC, ACT, PRO |

## Légende

**Priorité** (méthode MoSCoW) :

- **Indispensable** : le parcours central (compte, import Steam, ajout manuel, statut, recommandations) et les règles affichées (email validé, mot de passe oublié, suppression de compte).
- **Important** : timeline complète et suivi, alertes, profil avancé, autres plateformes de jeu, application mobile.
- **Bonus** : social, fil d'actualité, badges.
- **Plus tard** : ce que la feuille de route classe hors MVP et qui n'entre dans aucune catégorie ci-dessus.

**État** :

- **Fait** : le joueur peut le faire de bout en bout sur le web aujourd'hui.
- **En cours** : une partie existe (par exemple le serveur sans écran relié, un écran non relié, un développement non fusionné, une fonction incomplète).
- **À faire** : rien d'utilisable pour le moment.

Le mobile n'est pas un état : c'est la colonne « Plateforme ». Pour une story visant le web et le mobile, l'état reflète le web ; la version mobile reste à faire dans tous les cas.

## Vue d'ensemble

| Épic | Stories | Fait | En cours | À faire |
|---|---|---|---|---|
| CPT — Compte et sécurité | 9 | 3 | 2 | 4 |
| EXT — Comptes externes | 7 | 2 | 0 | 5 |
| COL — Collection | 7 | 4 | 0 | 3 |
| STA — Statut et progression | 2 | 2 | 0 | 0 |
| TIM — Timeline et suivi | 5 | 2 | 2 | 1 |
| ALE — Alertes | 4 | 0 | 0 | 4 |
| REC — Recommandations | 4 | 2 | 0 | 2 |
| SOC — Social | 6 | 0 | 0 | 6 |
| PRO — Profil | 8 | 2 | 2 | 4 |
| ACT — Fil d'actualité | 3 | 0 | 0 | 3 |
| ADM — Administration | 1 | 0 | 1 | 0 |
| **Total** | **56** | **17** | **7** | **32** |

## CPT — Compte et sécurité

Permettre à chacun de créer un compte protégé, d'y accéder facilement et d'en garder la maîtrise, jusqu'à sa suppression.

### CPT-01 — Créer un compte avec mon email

**En tant que** visiteur, **je veux** créer un compte avec mon adresse email et un mot de passe, **afin de** retrouver ma ludothèque sur tous mes appareils.

- **Priorité** : Indispensable
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/auth/register`
- **Critères d'acceptation** :
  - Un compte est créé quand l'email est valide et le mot de passe respecte les règles affichées sous le champ.
  - Une adresse email déjà utilisée est refusée avec un message explicite, sans créer de second compte.
  - Un mot de passe trop faible est refusé avant l'envoi du formulaire.
  - La version mobile reste à faire.

### CPT-02 — Valider mon adresse email

**En tant que** visiteur qui vient de s'inscrire, **je veux** confirmer mon adresse email par un lien reçu dans ma boîte, **afin de** prouver que le compte est bien le mien et d'éviter qu'on en ouvre un à ma place.

- **Priorité** : Indispensable
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Un email contenant un lien de validation est envoyé juste après l'inscription.
  - Cliquer sur le lien marque l'adresse comme validée et affiche un message de confirmation.
  - Un lien expiré ou déjà utilisé affiche une erreur et propose de renvoyer un email.
  - Tant que l'adresse n'est pas validée, un bandeau le rappelle au joueur.

### CPT-03 — Me connecter par email, Google ou Microsoft

**En tant que** visiteur ayant déjà un compte, **je veux** me connecter avec mon email ou avec mon compte Google ou Microsoft, **afin d'**accéder à ma ludothèque sans retaper un nouveau mot de passe.

- **Priorité** : Indispensable
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/auth/login`
- **Critères d'acceptation** :
  - Un identifiant correct ouvre la session et mène au tableau de bord.
  - Un identifiant ou un mot de passe incorrect affiche un message d'erreur sans préciser lequel des deux est faux.
  - Les boutons Google et Microsoft ouvrent le parcours d'autorisation du fournisseur, puis ramènent connecté dans NextQuest.
  - La version mobile reste à faire.

### CPT-04 — Me connecter avec Apple

**En tant que** visiteur qui utilise un appareil Apple, **je veux** me connecter avec mon identifiant Apple, **afin de** ne pas créer un compte de plus ni partager mon adresse personnelle.

- **Priorité** : Important
- **État** : En cours
- **Plateforme** : Web et mobile
- **Écran** : `/auth/login`
- **Critères d'acceptation** :
  - Le bouton Apple est actif et ouvre le parcours d'autorisation Apple (il est aujourd'hui présent mais désactivé).
  - Au retour, le joueur est connecté, et un compte est créé s'il n'en avait pas.
  - Si l'email Apple correspond à un compte existant, les deux comptes ne sont pas dupliqués.

### CPT-05 — Réinitialiser mon mot de passe oublié

**En tant que** joueur qui a oublié son mot de passe, **je veux** recevoir un lien pour en choisir un nouveau, **afin de** récupérer mon compte et ma ludothèque sans contacter personne.

- **Priorité** : Indispensable
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : `/auth/forgot-password`
- **Critères d'acceptation** :
  - Saisir une adresse email envoie un lien de réinitialisation, avec le même message de confirmation que l'adresse existe ou non.
  - Le lien permet de saisir un nouveau mot de passe respectant les règles de sécurité.
  - Un lien expiré ou déjà utilisé affiche une erreur et propose d'en demander un nouveau.
  - Après le changement, l'ancien mot de passe ne fonctionne plus.

### CPT-06 — Me déconnecter

**En tant que** joueur connecté, **je veux** fermer ma session, **afin de** protéger mon compte sur un appareil partagé.

- **Priorité** : Indispensable
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/dashboard`
- **Critères d'acceptation** :
  - Après la déconnexion, l'accès à une page privée renvoie vers la page de connexion.
  - Le bouton retour du navigateur ne rouvre pas de données personnelles.
  - La version mobile reste à faire.

### CPT-07 — Supprimer mon compte et toutes mes données

**En tant que** joueur connecté, **je veux** supprimer mon compte en une seule action, **afin d'**être sûr que toutes mes données personnelles disparaissent.

- **Priorité** : Indispensable
- **État** : En cours
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Une confirmation explicite (saisie du mot de passe ou d'un mot-clé) est demandée avant la suppression.
  - Après suppression, la connexion avec les anciens identifiants est impossible et aucune donnée personnelle (jeux, statuts, comptes liés, messages, recommandations) ne subsiste.
  - Un délai de grâce de 30 jours permet d'annuler la demande avant l'effacement définitif.
  - Les messages envoyés à d'autres joueurs restent visibles de leurs destinataires, avec l'expéditeur affiché comme « Utilisateur supprimé ».

### CPT-08 — Gérer mes consentements et exporter mes données

**En tant que** joueur connecté, **je veux** voir les consentements que j'ai donnés et télécharger toutes mes données, **afin d'**exercer mes droits RGPD sans écrire à l'équipe.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Les consentements (par exemple notifications, visibilité du profil) sont listés avec leur date et peuvent être retirés à tout moment.
  - L'export fournit un fichier téléchargeable contenant le profil, la collection, les statuts et les comptes liés.
  - Le fichier d'export ne contient ni mot de passe ni jeton de connexion.

### CPT-09 — Consulter les mentions légales et la politique de confidentialité

**En tant que** visiteur, **je veux** consulter les mentions légales et la politique de confidentialité, **afin de** savoir qui édite NextQuest et comment mes données sont traitées.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Web
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Les deux pages sont accessibles sans compte, depuis le pied de page de chaque écran.
  - La politique de confidentialité décrit les données collectées, leur finalité et les droits du joueur (accès, export, suppression).
  - Les pages sont disponibles en français et en anglais.

## EXT — Comptes externes

Centraliser en un seul endroit les bibliothèques que le joueur possède sur ses différentes plateformes de jeu.

### EXT-01 — Lier mon compte Steam

**En tant que** joueur qui a des jeux sur Steam, **je veux** relier mon compte Steam à NextQuest, **afin de** ne pas ressaisir mes jeux un par un.

- **Priorité** : Indispensable
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/game-list`
- **Critères d'acceptation** :
  - Le bouton Steam ouvre la page d'autorisation Steam puis ramène sur NextQuest avec le compte affiché comme connecté.
  - Si le joueur annule l'autorisation, aucun compte n'est lié et un message l'indique.
  - Un compte Steam déjà lié à un autre joueur NextQuest est refusé avec un message explicite.
  - La version mobile reste à faire.
  - Délier le compte Steam : la route API existe, mais aucun écran ne le permet encore (reste à faire côté écran).

### EXT-02 — Importer ma bibliothèque Steam

**En tant que** joueur qui a des jeux sur Steam, **je veux** importer toute ma bibliothèque Steam avec mon temps de jeu, **afin de** voir ma collection réelle dès le premier jour.

- **Priorité** : Indispensable
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/game-list`
- **Critères d'acceptation** :
  - Une progression de l'import (nombre de jeux traités) est visible pendant l'opération.
  - À la fin, les jeux importés apparaissent dans la collection avec leurs heures jouées.
  - Relancer l'import ne crée pas de doublon : un jeu déjà présent pour la plateforme Steam n'est pas ajouté une seconde fois.
  - Le temps de jeu importé est en lecture seule : le joueur ne peut pas le modifier.
  - Un profil Steam privé produit un message qui explique comment le rendre public. La version mobile reste à faire.

### EXT-03 — Importer ma bibliothèque PlayStation

**En tant que** joueur qui a des jeux sur PlayStation, **je veux** relier mon compte PSN et importer mes jeux, **afin de** voir ma collection console avec celle de mon PC.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Le joueur peut relier son compte PSN et lancer l'import depuis les mêmes écrans que Steam.
  - Les jeux importés portent la plateforme PlayStation ; un même jeu possédé sur Steam et PSN apparaît une fois par plateforme, sans doublon sur une même plateforme.
  - Un échec de connexion au compte PSN affiche une erreur compréhensible, sans perte des jeux déjà présents.

### EXT-04 — Importer ma bibliothèque Xbox

**En tant que** joueur qui a des jeux sur Xbox, **je veux** relier mon compte Xbox et importer mes jeux, **afin de** ne pas oublier ceux que je possède déjà.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Le joueur peut relier son compte Xbox et lancer l'import.
  - Les jeux importés portent la plateforme Xbox, sans doublon sur cette plateforme en cas de nouvel import.
  - Une erreur de connexion est expliquée et n'efface aucun jeu existant.

### EXT-05 — Importer ma bibliothèque Nintendo

**En tant que** joueur qui a des jeux sur Nintendo, **je veux** relier mon compte Nintendo et importer mes jeux, **afin de** voir ma collection Switch dans NextQuest.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Le joueur peut relier son compte Nintendo et lancer l'import.
  - Les jeux importés portent la plateforme Nintendo, sans doublon sur cette plateforme.
  - Une erreur de connexion est expliquée et n'efface aucun jeu existant.

### EXT-06 — Importer ma bibliothèque Epic Games

**En tant que** joueur qui a des jeux sur Epic Games, **je veux** relier mon compte Epic et importer mes jeux, **afin d'**y retrouver aussi les jeux gratuits que j'ai récupérés.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Le joueur peut relier son compte Epic et lancer l'import.
  - Les jeux importés portent la plateforme Epic, sans doublon sur cette plateforme.
  - Une erreur de connexion est expliquée et n'efface aucun jeu existant.

### EXT-07 — Garder mes données à jour automatiquement

**En tant que** joueur qui a relié plusieurs comptes, **je veux** que mon temps de jeu et mes bibliothèques se mettent à jour sans que je relance l'import, **afin de** voir une collection toujours à jour.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Les comptes externes reliés sont resynchronisés à intervalle régulier, sans action du joueur.
  - Le temps de jeu importé est mis à jour et reste en lecture seule.
  - La date de la dernière synchronisation est visible, et un échec de synchronisation n'efface aucune donnée existante.

## COL — Collection

Offrir une vue unique, claire et à jour de tous les jeux du joueur, quelle que soit leur origine.

### COL-01 — Parcourir et rechercher ma collection

**En tant que** joueur qui a des jeux sur plusieurs plateformes, **je veux** voir tous mes jeux au même endroit et y chercher un titre, **afin de** savoir immédiatement ce que je possède avant d'acheter.

- **Priorité** : Indispensable
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/game-list`
- **Critères d'acceptation** :
  - Chaque jeu s'affiche avec sa jaquette, son titre, son statut et sa plateforme.
  - La recherche par titre réduit la liste aux jeux correspondants ; sans résultat, un message « aucun jeu trouvé » s'affiche.
  - Un jeu possédé sur deux plateformes apparaît une fois par plateforme, mais jamais deux fois sur la même plateforme.
  - La version mobile reste à faire.

### COL-02 — Ajouter un jeu à la main

**En tant que** joueur qui possède un jeu hors des plateformes reliées, **je veux** chercher un jeu par son titre et l'ajouter à ma collection, **afin d'**avoir une collection complète, même pour mes jeux physiques.

- **Priorité** : Indispensable
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/game-list`
- **Critères d'acceptation** :
  - La recherche propose des jeux du catalogue avec jaquette et année de sortie.
  - Le joueur choisit la plateforme du jeu avant de valider ; le jeu apparaît ensuite dans sa collection.
  - Ajouter un jeu déjà présent sur la même plateforme est refusé avec un message, sans doublon.
  - La version mobile reste à faire.

### COL-03 — Consulter la fiche d'un jeu

**En tant que** joueur connecté, **je veux** ouvrir la fiche d'un jeu, **afin de** décider si j'y joue ce soir ou si je l'achète.

- **Priorité** : Indispensable
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/games/:gameId`
- **Critères d'acceptation** :
  - La fiche affiche la jaquette, la description, les genres, la date de sortie et la note des joueurs.
  - Elle indique le statut du jeu dans la collection du joueur, et permet de le changer.
  - Un jeu inexistant affiche une page « jeu introuvable ». La version mobile reste à faire.

### COL-04 — Retirer ou ignorer un jeu

**En tant que** joueur connecté, **je veux** retirer un jeu de ma collection ou l'ignorer, **afin de** garder une liste propre et de ne plus voir ce qui ne m'intéresse pas.

- **Priorité** : Important
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/game-list`
- **Critères d'acceptation** :
  - Une confirmation est demandée avant de retirer un jeu.
  - Un jeu retiré disparaît de la collection et des filtres de statut.
  - Un jeu ignoré n'apparaît plus dans les recommandations.
  - La version mobile reste à faire.

### COL-05 — Consulter ma collection sur téléphone

**En tant que** joueur qui est souvent en déplacement, **je veux** ouvrir l'application mobile et voir ma collection à jour, **afin de** choisir mon prochain jeu sans ouvrir mon ordinateur.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Après connexion dans l'application, la liste affiche les mêmes jeux et statuts que sur le web.
  - La recherche par titre et le filtre par statut sont disponibles.
  - Les boutons et zones cliquables font au moins 44 par 44 points.
  - Sans réseau, un message indique que la liste n'est pas à jour.

### COL-06 — Ajouter un jeu à ma wishlist

**En tant que** joueur qui repère des jeux à acquérir, **je veux** ajouter un jeu à ma liste de souhaits, y compris à la main, **afin de** ne pas oublier ce que je veux acheter.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Un jeu du catalogue peut être ajouté à la wishlist depuis sa fiche, sans l'ajouter à la collection.
  - Un jeu absent du catalogue peut être ajouté à la main, avec son titre.
  - La wishlist est distincte du suivi d'un jeu à venir (TIM-04) et se consulte dans un écran dédié.
  - Un jeu de la wishlist peut être retiré, ou passé dans la collection une fois acquis.
  - Les alertes de sortie et de changement de date portent sur les jeux de la wishlist (ALE-01).

### COL-07 — Ajouter un jeu absent du catalogue

**En tant que** joueur dont le jeu n'existe pas dans le catalogue, **je veux** créer moi-même la fiche d'un jeu introuvable, **afin d'**avoir une collection vraiment complète.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Le titre personnalisé est obligatoire ; sans titre, la validation est refusée avec un message.
  - Le joueur peut ajouter une image de couverture, des tags personnalisés, un statut initial et une note personnelle.
  - Le jeu créé n'est visible que dans la collection de son auteur.
  - Le jeu respecte la règle de doublon par plateforme.

## STA — Statut et progression

Aider le joueur à savoir où il en est dans chacun de ses jeux et à réduire son backlog.

### STA-01 — Changer le statut d'un jeu

**En tant que** joueur connecté, **je veux** indiquer qu'un jeu est à faire, en cours, terminé ou abandonné, **afin de** savoir à tout moment où j'en suis.

- **Priorité** : Indispensable
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/game-list`
- **Critères d'acceptation** :
  - Un jeu n'a qu'un seul statut à la fois : choisir un nouveau statut remplace l'ancien.
  - Le changement est visible aussitôt dans la liste et sur la fiche du jeu.
  - Si l'enregistrement échoue, le statut précédent est conservé et un message d'erreur s'affiche.
  - La version mobile reste à faire.

### STA-02 — Filtrer ma collection par statut

**En tant que** joueur dont le backlog déborde, **je veux** n'afficher que les jeux d'un statut donné, **afin de** voir en un coup d'œil ce qu'il me reste à jouer.

- **Priorité** : Indispensable
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/game-list`
- **Critères d'acceptation** :
  - Choisir « à faire » n'affiche que les jeux à ce statut, et le nombre de jeux correspondant.
  - Un statut sans jeu affiche un message d'état vide.
  - Revenir à « tous » réaffiche toute la collection.
  - La version mobile reste à faire.

## TIM — Timeline et suivi

Permettre au joueur de ne rater aucune sortie qui l'intéresse.

### TIM-01 — Voir les prochaines sorties

**En tant que** joueur qui a peu de temps libre, **je veux** consulter la liste des prochains jeux à sortir, **afin de** repérer ceux qui m'intéressent à temps.

- **Priorité** : Important
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/timeline`
- **Critères d'acceptation** :
  - Les jeux sont classés par date de sortie croissante, avec jaquette, titre, date et plateformes.
  - Les jeux annoncés sans date précise apparaissent avec la mention « date à confirmer ».
  - La liste se charge par pages ; la suite s'affiche quand on atteint le bas de la liste.
  - La version mobile reste à faire.

### TIM-02 — Filtrer les sorties par genre

**En tant que** joueur qui aime certains genres, **je veux** filtrer les sorties par genre, **afin de** ne voir que celles qui me parlent.

- **Priorité** : Important
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/timeline`
- **Critères d'acceptation** :
  - Sélectionner un ou plusieurs genres réduit la liste aux sorties de ces genres.
  - Un filtre sans résultat affiche un message d'état vide.
  - Le filtre peut être retiré en un geste. La version mobile reste à faire.

### TIM-03 — Filtrer les sorties par plateforme et par date

**En tant que** joueur qui ne possède qu'une console, **je veux** filtrer les sorties par plateforme et par période, **afin de** ne voir que les jeux que je pourrai réellement lancer.

- **Priorité** : Important
- **État** : En cours
- **Plateforme** : Web et mobile
- **Écran** : `/timeline`
- **Critères d'acceptation** :
  - Choisir une plateforme n'affiche que les sorties disponibles sur celle-ci.
  - Choisir une période (par exemple ce mois-ci, les trois prochains mois) n'affiche que les sorties de cette période.
  - Les filtres plateforme, date et genre se cumulent.
  - Seul le filtre par genre existe aujourd'hui ; la version mobile reste à faire.

### TIM-04 — Suivre un jeu à venir

**En tant que** joueur qui attend une sortie, **je veux** suivre un jeu pas encore sorti, **afin de** le retrouver dans ma liste de suivi et être prévenu à sa sortie.

- **Priorité** : Important
- **État** : En cours
- **Plateforme** : Web et mobile
- **Écran** : `/timeline`
- **Critères d'acceptation** :
  - Un bouton permet de suivre ou de ne plus suivre un jeu, et son état est visible sur la carte du jeu.
  - Le suivi est distinct de la wishlist (COL-06) : il sert à repérer une sortie, sans déclarer l'envie d'acquérir le jeu.
  - Les jeux suivis sont conservés sur le compte : je les retrouve après une déconnexion ou depuis un autre appareil.
  - Aujourd'hui, l'écran web mémorise le suivi dans le navigateur seulement ; la version mobile reste à faire.

### TIM-05 — Filtrer les sorties par studio ou éditeur

**En tant que** joueur fidèle à certains studios, **je veux** filtrer les sorties par studio ou par éditeur, **afin de** retrouver les prochains jeux de ceux que j'apprécie.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : `/timeline`
- **Critères d'acceptation** :
  - Sélectionner un studio ou un éditeur réduit la liste aux sorties correspondantes.
  - Ce filtre se cumule avec ceux de genre, de plateforme et de date.
  - Un filtre sans résultat affiche un message d'état vide.

## ALE — Alertes

Prévenir le joueur au bon moment, sans qu'il ait à vérifier lui-même.

### ALE-01 — Être alerté de la sortie d'un jeu de ma wishlist

**En tant que** joueur qui a un long backlog, **je veux** être prévenu quand un jeu de ma wishlist sort ou change de date, **afin de** ne pas rater une sortie.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Une notification apparaît dans l'application le jour de la sortie d'un jeu de ma wishlist (COL-06) ou d'un jeu que je suis (TIM-04).
  - Un changement de date de sortie génère une notification qui indique l'ancienne et la nouvelle date.
  - Une notification peut être marquée comme lue, et le compteur de non lues diminue.
  - La version mobile reste à faire.

### ALE-02 — Régler mes préférences de notification

**En tant que** joueur connecté, **je veux** choisir les types d'alertes que je reçois et par quel canal, **afin de** n'être dérangé que pour ce qui compte pour moi.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Chaque type d'alerte (sortie, changement de date, mise à jour, social) peut être activé ou désactivé séparément.
  - Les canaux disponibles sont la notification push sur mobile et l'email ; chacun se règle séparément.
  - L'email n'est envoyé qu'après un consentement explicite du joueur, retirable à tout moment.
  - Un type désactivé ne produit plus aucune notification, dès l'enregistrement du réglage.
  - Les réglages sont conservés après déconnexion.
  - La version mobile reste à faire.

### ALE-03 — Recevoir une notification push sur mon téléphone

**En tant que** joueur qui a installé l'application mobile, **je veux** recevoir une notification sur mon téléphone, **afin d'**être prévenu d'une sortie même quand l'application est fermée.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - L'application demande l'autorisation d'envoyer des notifications, et respecte un refus.
  - Une alerte de sortie arrive sur le téléphone verrouillé, et toucher la notification ouvre la fiche du jeu.
  - Désactiver les alertes dans les préférences stoppe les notifications push.

### ALE-04 — Être alerté des mises à jour importantes de mes jeux

**En tant que** joueur qui possède de nombreux jeux, **je veux** être alerté des mises à jour importantes de mes jeux, **afin d'**avoir une raison de revenir y jouer.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Une notification est envoyée pour une mise à jour importante d'un jeu de ma collection, et pas pour un jeu que je ne possède pas.
  - La notification nomme le jeu et résume la mise à jour, avec un lien vers l'actualité.
  - Ce type d'alerte se désactive séparément dans les préférences (ALE-02).

## REC — Recommandations

Dire au joueur à quoi jouer ensuite, à partir de ce qu'il possède et de ce qu'il aime.

### REC-01 — Obtenir des recommandations personnalisées

**En tant que** joueur qui ne sait pas quoi lancer ce soir, **je veux** recevoir des jeux recommandés d'après ma collection et mes heures de jeu, **afin de** choisir en quelques secondes.

- **Priorité** : Indispensable
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/next-quest`
- **Critères d'acceptation** :
  - Les recommandations sont rangées en trois familles : des découvertes, des jeux de ma bibliothèque jamais lancés, des sorties à venir.
  - Une découverte n'est jamais un jeu déjà présent dans ma collection, même ignoré.
  - Un bouton permet de générer un nouveau lot ; un indicateur de chargement est visible pendant le calcul.
  - Un joueur sans collection voit un message qui l'invite à importer ou à ajouter des jeux.
  - La version mobile reste à faire.

### REC-02 — Dire si une recommandation me plaît

**En tant que** joueur connecté, **je veux** indiquer « j'aime » ou « je n'aime pas » sur chaque recommandation, **afin d'**obtenir des suggestions de plus en plus proches de mes goûts.

- **Priorité** : Indispensable
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/next-quest`
- **Critères d'acceptation** :
  - Un jeu noté disparaît de la pile et la carte suivante s'affiche.
  - Un jeu que je n'aime pas ne revient pas dans les lots suivants.
  - Le dernier avis est conservé après rechargement de la page.
  - La version mobile reste à faire.

### REC-03 — Recevoir mes recommandations sur téléphone

**En tant que** joueur qui a peu de temps libre, **je veux** parcourir mes recommandations depuis mon téléphone, **afin de** choisir mon jeu du soir depuis mon canapé.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Les recommandations de l'application mobile sont les mêmes que sur le web pour un même compte.
  - Un geste de glissement vers la droite signifie « j'aime » et vers la gauche « je n'aime pas », avec un bouton équivalent pour chaque geste.
  - L'avis donné sur mobile est pris en compte sur le web.

### REC-04 — Obtenir des suggestions de jeux courts

**En tant que** joueur qui a peu de temps libre, **je veux** recevoir des suggestions de jeux courts, adaptées au temps dont je dispose, **afin de** jouer malgré mon temps limité.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Le joueur indique le temps dont il dispose (par exemple moins d'une heure, une soirée).
  - Les suggestions sont triées par durée de jeu compatible avec ce temps.
  - Un jeu dont la durée est inconnue n'est pas présenté comme court.

## SOC — Social

Faire de la ludothèque un point de rencontre entre joueurs, avec des échanges limités aux personnes de confiance.

### SOC-01 — Ajouter un ami

**En tant que** joueur connecté, **je veux** envoyer une demande d'ami à un autre joueur, **afin de** partager ma ludothèque avec des proches.

- **Priorité** : Bonus
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - La demande n'établit l'amitié qu'une fois acceptée par l'autre joueur ; il peut aussi la refuser.
  - Le destinataire voit la demande en attente dans l'application.
  - Un joueur ne peut pas envoyer deux demandes à la même personne ni à lui-même.
  - Un ami peut être retiré à tout moment, ce qui supprime le lien des deux côtés.

### SOC-02 — Échanger des messages avec mes amis

**En tant que** joueur connecté, **je veux** envoyer des messages privés à mes amis, **afin de** nous mettre d'accord sur un jeu à lancer ensemble.

- **Priorité** : Bonus
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Par défaut, seuls mes amis peuvent m'écrire ; un message d'un non-ami est refusé, sauf si j'ai choisi un réglage qui l'autorise.
  - Un message envoyé apparaît dans la conversation des deux joueurs, avec son heure.
  - Un message vide ou de plus de 2 000 caractères est refusé avec un message d'erreur.

### SOC-03 — Partager un jeu avec un ami

**En tant que** joueur connecté, **je veux** partager la fiche d'un jeu avec un ami, **afin de** lui recommander un titre qui m'a plu.

- **Priorité** : Bonus
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Le partage n'est proposé que vers un ami.
  - L'ami reçoit le jeu dans la conversation, avec un lien vers sa fiche.
  - Le partage d'un jeu déjà présent dans la collection de l'ami l'indique clairement.

### SOC-04 — Signaler un utilisateur ou un message

**En tant que** joueur connecté, **je veux** signaler un comportement abusif, **afin de** me protéger et de protéger la communauté.

- **Priorité** : Bonus
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Un signalement se fait en choisissant un motif, avec un champ libre facultatif.
  - Le joueur reçoit une confirmation que son signalement est enregistré.
  - Le joueur signalé n'est pas informé de l'identité de l'auteur du signalement.

### SOC-05 — Voir ce que mes amis jouent en ce moment

**En tant que** joueur qui aime jouer entre amis, **je veux** voir le statut en temps réel de mes amis (en train de jouer à… ou vient de finir…), **afin de** les rejoindre dans leur jeu.

- **Priorité** : Bonus
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Le statut d'un ami affiche le jeu en cours ou le dernier jeu terminé, et se met à jour sans recharger la page.
  - Un ami au profil privé ou qui a masqué son statut n'apparaît pas.
  - Un joueur peut masquer son propre statut.

### SOC-06 — Bloquer un utilisateur

**En tant que** joueur connecté, **je veux** bloquer un utilisateur à tout moment, **afin de** ne plus être contacté par une personne indésirable.

- **Priorité** : Bonus
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Un joueur bloqué ne peut plus m'envoyer de message ni de demande d'ami.
  - Le blocage peut être levé à tout moment depuis mes réglages.
  - Si le joueur bloqué était mon ami, le lien d'amitié est supprimé.

## PRO — Profil

Donner au joueur une identité et un tableau de bord de son activité, sous son contrôle.

### PRO-01 — Modifier ma bio et la visibilité de mon profil

**En tant que** joueur connecté, **je veux** écrire une courte présentation et choisir qui peut voir mon profil, **afin de** maîtriser ce que les autres savent de moi.

- **Priorité** : Important
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/profil`
- **Critères d'acceptation** :
  - La bio est limitée à une longueur affichée sous le champ, et un texte trop long est refusé.
  - Le choix de visibilité (par exemple public ou privé) est enregistré et conservé après rechargement.
  - Un profil privé n'est pas consultable par un autre joueur.
  - La version mobile reste à faire.

### PRO-02 — Choisir mon avatar

**En tant que** joueur connecté, **je veux** envoyer une image comme avatar, **afin de** personnaliser mon profil.

- **Priorité** : Important
- **État** : En cours
- **Plateforme** : Web et mobile
- **Écran** : `/profil`
- **Critères d'acceptation** :
  - Une image au format accepté et de taille limitée devient immédiatement mon avatar.
  - Un fichier d'un format non pris en charge ou trop lourd est refusé avec un message qui indique la limite.
  - L'envoi est prêt côté serveur, mais l'écran web n'est pas encore relié ; la version mobile reste à faire.

### PRO-03 — Voir mes statistiques de jeu

**En tant que** joueur qui possède des jeux sur plusieurs plateformes, **je veux** voir des statistiques sur ma ludothèque, **afin de** mesurer l'état de mon backlog et mon temps de jeu.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Le nombre de jeux par statut, le nombre total de jeux et le temps de jeu cumulé sont affichés.
  - La répartition par plateforme et par genre est visible.
  - Les genres préférés et les studios favoris sont mis en avant d'après la collection.
  - Les chiffres correspondent à la collection affichée dans la liste de jeux.

### PRO-04 — Gagner des badges

**En tant que** joueur connecté, **je veux** débloquer des badges quand j'atteins des objectifs, **afin de** trouver une motivation à finir mes jeux.

- **Priorité** : Bonus
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Un badge se débloque quand son objectif affiché est atteint (par exemple terminer 10 jeux).
  - Les badges obtenus et ceux restant à obtenir sont distincts sur le profil, avec la règle de déblocage.
  - Un badge, une fois obtenu, n'est pas retiré.

### PRO-05 — Suivre mon parcours d'accueil

**En tant que** nouveau joueur, **je veux** être guidé à ma première connexion, **afin d'**avoir une collection remplie sans chercher où cliquer.

- **Priorité** : Indispensable
- **État** : Fait
- **Plateforme** : Web et mobile
- **Écran** : `/dashboard`
- **Critères d'acceptation** :
  - Le parcours s'affiche à la première connexion et propose de relier Steam.
  - Il peut être passé, et ne revient pas après avoir été terminé ou passé.
  - La version mobile reste à faire.

### PRO-06 — Choisir la langue de l'application

**En tant que** joueur connecté, **je veux** passer l'application du français à l'anglais et inversement, **afin de** l'utiliser dans la langue que je préfère.

- **Priorité** : Important
- **État** : En cours
- **Plateforme** : Web et mobile
- **Écran** : `/profil`
- **Critères d'acceptation** :
  - Choisir une langue traduit immédiatement les menus et les messages, sans recharger la page.
  - Le choix est conservé à la reconnexion.
  - Aujourd'hui les textes existent en français et en anglais, mais aucun sélecteur de langue n'est proposé à l'écran.
  - La version mobile reste à faire.

### PRO-07 — Voir mes succès

**En tant que** joueur qui vise le 100 %, **je veux** voir mes succès de jeu sur mon profil, **afin de** mesurer ma progression dans chaque jeu.

- **Priorité** : Plus tard
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Les succès et trophées des plateformes reliées sont importés avec la bibliothèque.
  - Pour un jeu d'une plateforme reliée, les succès obtenus et ceux restants sont listés.
  - Le nombre de succès obtenus sur le total est affiché sur la fiche du jeu.
  - Un jeu sans succès affiche « aucun succès pour ce jeu ».

### PRO-08 — Présenter mes jeux joués et mon activité récente

**En tant que** joueur connecté, **je veux** voir sur mon profil mes jeux joués, en cours et terminés, ainsi que mon activité récente, **afin de** montrer mon parcours de joueur.

- **Priorité** : Important
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Le profil liste séparément les jeux joués, en cours et terminés.
  - L'activité récente (jeux ajoutés, terminés, badges obtenus) s'affiche du plus récent au plus ancien.
  - Ce contenu respecte la visibilité choisie pour le profil (PRO-01).

## ACT — Fil d'actualité

Tenir le joueur informé de ce qui se passe dans son univers de jeu et chez ses amis.

### ACT-01 — Suivre l'activité de mes amis

**En tant que** joueur connecté, **je veux** voir ce que mes amis ont ajouté ou terminé, **afin de** trouver des idées de jeux et de discuter avec eux.

- **Priorité** : Bonus
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : `/actualites`
- **Critères d'acceptation** :
  - Le fil affiche les activités récentes de mes amis (jeu ajouté, jeu terminé), du plus récent au plus ancien.
  - Le fil peut aussi proposer des recommandations et des annonces de l'équipe NextQuest, distinguées des activités d'amis.
  - Un ami au profil privé n'apparaît pas dans le fil.
  - Un joueur sans ami voit un message qui l'invite à en ajouter.

### ACT-02 — Lire les actualités des jeux qui m'intéressent

**En tant que** joueur connecté, **je veux** lire les nouvelles concernant les jeux de ma collection et ceux que je suis, **afin de** savoir quand sort une mise à jour ou une extension.

- **Priorité** : Bonus
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : `/actualites`
- **Critères d'acceptation** :
  - Seules les actualités de jeux présents dans ma collection ou suivis sont affichées.
  - Chaque actualité indique sa date et le jeu concerné, et mène à sa source.
  - La page, qui affiche aujourd'hui un message « à venir », est remplacée par ce fil.

### ACT-03 — Suivre un studio et lire ses actualités

**En tant que** joueur fidèle à certains studios, **je veux** suivre un studio, **afin de** lire ses actualités dans mon fil.

- **Priorité** : Bonus
- **État** : À faire
- **Plateforme** : Web et mobile
- **Écran** : `/actualites`
- **Critères d'acceptation** :
  - Un bouton permet de suivre ou de ne plus suivre un studio.
  - Le fil affiche les actualités des studios suivis, avec date et lien vers la source.
  - Un studio sans actualité récente n'ajoute rien au fil.

## ADM — Administration

Permettre à l'équipe de garder un catalogue de jeux fiable et à jour.

### ADM-01 — Enrichir le catalogue de jeux

**En tant qu'**administrateur, **je veux** lancer l'enrichissement des fiches de jeux incomplètes, **afin d'**offrir aux joueurs des fiches complètes et à jour.

- **Priorité** : Important
- **État** : En cours
- **Plateforme** : Web
- **Écran** : à maquetter
- **Critères d'acceptation** :
  - Seul un administrateur peut lancer l'enrichissement ; un joueur ordinaire reçoit un refus.
  - À la fin, le nombre de fiches complétées est affiché.
  - Une fiche déjà complète n'est pas modifiée.
  - Seule l'action côté serveur existe aujourd'hui ; aucun écran d'administration.

## Correspondance avec le cahier des charges

| Story d'origine du cahier des charges | Backlog |
|---|---|
| En tant que joueur, je veux connecter mon compte Steam afin d'importer automatiquement ma bibliothèque de jeux. | EXT-01, EXT-02 |
| En tant que joueur, je veux ajouter manuellement un jeu afin de suivre des jeux non listés dans les API. | COL-02, COL-07 |
| En tant que joueur, je veux marquer un jeu comme "terminé" afin de suivre ma progression. | STA-01 |
| En tant que joueur, je veux filtrer mes jeux par statut afin de voir facilement mon backlog. | STA-02 |
| En tant que joueur, je veux recevoir des recommandations basées sur mes jeux préférés afin de découvrir de nouveaux titres. | REC-01, REC-02 |
| En tant que joueur casual, je veux des suggestions de jeux courts afin de jouer malgré mon temps limité. | REC-04 |
| En tant que joueur, je veux ajouter des amis afin de voir leur activité gaming. | SOC-01 |
| En tant que joueur, je veux voir ce que mes amis jouent en ce moment afin de les rejoindre. | SOC-05 |
| En tant que joueur, je veux partager une recommandation à un ami afin de lui faire découvrir un jeu. | SOC-03 |
| En tant que joueur, je veux être notifié quand un jeu de ma wishlist sort afin de ne pas le manquer. | COL-06, ALE-01 |
| En tant que joueur, je veux être alerté des mises à jour importantes de mes jeux afin de revenir y jouer. | ALE-04 |
