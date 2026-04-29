# Configuration GitHub -- Actions manuelles

Ce document liste les reglages a appliquer manuellement dans **GitHub Settings** (au-dela des fichiers commits dans le repo).

A faire une seule fois, par un admin du repo.

---

## 1. Branch protection sur `develop` et `main`

**Pourquoi :** garantir qu'aucun code non review ou casse n'arrive sur les branches d'integration ou de prod.

### Etapes

1. **Settings > Branches > Add branch ruleset** (ou "Add rule" en classique)
2. Repeter la config ci-dessous pour `develop` puis pour `main`

### Reglages a activer

| Option | Valeur | Pourquoi |
|--------|--------|----------|
| Require a pull request before merging | OUI | Pas de push direct sur develop/main |
| Require approvals | OUI, 1 approbation | L'autre dev doit valider |
| Dismiss stale pull request approvals when new commits are pushed | OUI | Forcer une re-review si on push apres approbation |
| Require review from Code Owners | OUI | CODEOWNERS s'applique automatiquement |
| Require status checks to pass before merging | OUI | CI doit etre verte |
| Required status checks | `ci`, `Analyze (javascript-typescript)` | Lint+typecheck+test+build + CodeQL |
| Require branches to be up to date before merging | OUI | Pas de merge sur une branche obsolete |
| Require conversation resolution before merging | OUI | Toutes les remarques de review resolues |
| Require linear history | OUI | Pas de merge commits, historique propre |
| Block force pushes | OUI | Un force push casserait l'historique partage |
| Restrict deletions | OUI | Personne ne peut supprimer la branche par accident |

### Exception pour `main`

`main` recoit uniquement des merges depuis `develop` quand on est pret a livrer. Memes regles que `develop`, plus :
- Restrict who can push : limiter au compte admin (toi)

---

## 2. Default branch = `develop`

**Pourquoi :** `main` represente la prod stable, `develop` est la branche de travail.

**Settings > General > Default branch > Switch to `develop`**

---

## 3. Activer Dependabot

Le fichier `.github/dependabot.yml` est deja en place. Reste a verifier que Dependabot est active dans le repo :

**Settings > Code security and analysis** :
- Dependabot alerts : ON
- Dependabot security updates : ON
- Dependabot version updates : ON (lit le fichier `dependabot.yml`)

---

## 4. Activer Code scanning (CodeQL)

Le workflow `.github/workflows/codeql.yml` est en place. Verifier que GitHub Advanced Security est dispo :

**Settings > Code security and analysis** :
- Code scanning : ON
- Default setup : laisser en advanced (le workflow custom prend le dessus)

Les resultats apparaissent dans l'onglet **Security > Code scanning alerts**.

---

## 5. Secret scanning

Active par defaut sur les repos publics. Pour un repo prive :

**Settings > Code security and analysis** :
- Secret scanning : ON
- Push protection : ON (bloque un push qui contiendrait un secret avant qu'il n'arrive sur GitHub)

---

## 6. Inviter Lorelei et configurer ses droits

Lorelei est deja collaboratrice (`Meii-Dicale`). Verifier :

**Settings > Collaborators** : Meii-Dicale doit avoir le role **Write** (ou **Maintain** pour qu'elle puisse aussi gerer les issues / labels).

---

## 7. Issues et Projects (optionnel)

Pour le suivi des taches :

- **Issues** : ON (Settings > Features > Issues)
- **Projects** : creer un Project type "Board" pour suivre les features par status (To do / In progress / Review / Done)

Si on prefere garder Trello, on n'active pas Projects.

---

## Checklist de validation

Apres avoir fait les etapes ci-dessus, tester :

- [ ] Tenter un push direct sur `develop` -> doit etre rejete
- [ ] Ouvrir une PR -> CI se declenche, CodeQL aussi
- [ ] Voir Lorelei automatiquement assignee comme reviewer si on touche `apps/web/`
- [ ] Voir une PR Dependabot apparaitre apres lundi prochain (peut etre force avec `Settings > Code security > Dependabot > Recheck`)
- [ ] L'onglet **Security** du repo affiche les resultats CodeQL
