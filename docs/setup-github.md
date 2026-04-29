# Configuration GitHub -- Etat actuel

Ce document liste l'etat de la configuration GitHub du repo `Jeeiib/NextQuest` et les **dernieres etapes manuelles** a faire dans GitHub Settings.

La majorite de la config a ete appliquee automatiquement via le `gh` CLI. Ce qui reste est limite par le plan GitHub (repo prive sans GitHub Advanced Security).

---

## Deja fait automatiquement (via `gh` CLI)

### Repository settings

- Default branch : `develop`
- `delete_branch_on_merge` : ON (les branches `feature/*` sont supprimees apres merge)
- `allow_merge_commit` : OFF (force l'historique lineaire)
- `allow_squash_merge` : ON
- `allow_rebase_merge` : ON
- Dependabot alerts : ON
- Dependabot security updates : ON (PRs auto pour les CVE)

### Branch protection rulesets

Deux rulesets actifs (visible dans Settings > Rules > Rulesets) :

**Protect develop** (id 15709531)
- Pull request required (1 approbation, code owner review, dismiss stale, resolve threads)
- Status check `ci` requis
- Linear history requise
- Pas de force push, pas de suppression
- Methodes de merge : squash + rebase

**Protect main** (id 15709674)
- Memes regles que develop
- En plus : `require_last_push_approval` (re-review obligatoire si push apres approbation)

JB et Lorelei sont co-owners et peuvent tous les deux push (pas de "restrict who can push").

---

## Reste a faire manuellement

Le repo est **prive sans GitHub Advanced Security**, donc certaines features de securite sont desactivees par defaut. Deux options :

### Option A -- Repo public (recommande pour la certification)

Passer le repo en public donne acces gratuit a :
- Secret scanning + push protection
- Code scanning (CodeQL)
- GitHub Advanced Security

**Settings > General > Danger Zone > Change visibility > Make public**

Apres passage en public, activer dans **Settings > Code security and analysis** :
- Secret scanning : ON
- Push protection : ON
- Code scanning : ON (le workflow `.github/workflows/codeql.yml` prendra le relais)

Une fois Code scanning active, le job `Analyze (javascript-typescript)` qui echoue actuellement passera et apparaitra dans la liste des status checks. On pourra alors l'ajouter aux rulesets via :

```bash
# A executer une fois Code scanning active
gh api repos/Jeeiib/NextQuest/rulesets/15709531 --jq '.rules' > /tmp/rules.json
# Editer /tmp/rules.json pour ajouter le check
gh api -X PUT repos/Jeeiib/NextQuest/rulesets/15709531 -f rules=@/tmp/rules.json
# Pareil pour le ruleset main (id 15709674)
```

### Option B -- Garder le repo prive

CodeQL ne pourra pas uploader les resultats (job en echec permanent), il faut donc **desactiver le workflow CodeQL** :

```bash
git rm .github/workflows/codeql.yml
git commit -m "chore: remove CodeQL workflow (requires public repo or GHAS)"
```

Et preciser dans la soutenance CDA que CodeQL etait prevu mais necessite un upgrade Advanced Security pour repos prives.

---

## Inviter Lorelei comme collaboratrice

Si pas deja fait :

**Settings > Collaborators > Add people > Meii-Dicale > role: Maintain**

Le role `Maintain` lui permet de gerer les issues, labels et de merger des PRs (ce que `Write` ne permet pas pour les PRs sur branche protegee).

---

## Verifications

```bash
# Lister les rulesets actifs
gh api repos/Jeeiib/NextQuest/rulesets

# Voir le detail d'un ruleset
gh api repos/Jeeiib/NextQuest/rulesets/15709531
gh api repos/Jeeiib/NextQuest/rulesets/15709674

# Verifier que Dependabot tourne
gh api repos/Jeeiib/NextQuest/dependabot/alerts 2>&1 | head -5

# Tester la protection : tenter un push direct sur develop
git checkout develop
git push  # doit etre rejete
```

---

## Checklist finale

- [x] Default branch = develop
- [x] Auto-delete des branches mergees
- [x] Pas de merge commits (squash + rebase only)
- [x] Ruleset develop applique
- [x] Ruleset main applique
- [x] Dependabot alerts ON
- [x] Dependabot security updates ON
- [x] CODEOWNERS en place (back -> JB, front -> Lorelei)
- [x] PR template en place
- [x] CI verte (lint + typecheck + migrations + tests + build)
- [ ] Repo public (ou desactivation CodeQL si on garde prive)
- [ ] Secret scanning + Push protection (apres passage public)
- [ ] Code scanning active (apres passage public)
- [ ] Lorelei ajoutee comme `Maintain`
