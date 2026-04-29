# Configuration GitHub -- Etat actuel

Repo : `nextquest-team/NextQuest` -- **public**

Toute la securite a ete configuree automatiquement via le `gh` CLI. Ce document trace l'etat final.

---

## Visibilite

- **Public** -- Le code est visible par tout le monde, mais aucun externe ne peut merger sans approbation JB ou Lorelei (rulesets stricts).
- N'importe qui peut forker et ouvrir une PR -> elle ira dans la queue de review, pas mergee tant que pas approuvee par un code owner.
- Issues, Wiki, Projects, Discussions : **desactives** (pas de spam d'inconnus).

## Repository settings

- Default branch : `develop`
- `delete_branch_on_merge` : ON (les `feature/*` sont supprimees apres merge)
- `allow_merge_commit` : OFF (force l'historique lineaire)
- `allow_squash_merge` : ON
- `allow_rebase_merge` : ON

## Branch protection rulesets

Deux rulesets actifs (`Settings > Rules > Rulesets`) :

**Protect develop** (id 15709531)
- Pull request requise (1 approbation, code owner review, dismiss stale reviews, resoudre les threads)
- Status check `ci` requis
- Linear history obligatoire
- Pas de force push, pas de suppression
- Methodes de merge : squash + rebase

**Protect main** (id 15709674)
- Memes regles que develop
- En plus : `require_last_push_approval` (re-review obligatoire si push apres approbation)

JB et Lorelei sont co-owners sans restriction de push.

## Securite

- **Dependabot alerts** : ON (32 vulnerabilites detectees sur les deps actuelles, des PRs auto vont arriver)
- **Dependabot security updates** : ON (PRs auto pour les CVE)
- **Dependabot version updates** : ON (`.github/dependabot.yml`, weekly minor/patch grouped)
- **Secret scanning** : ON (alerte si un secret est commit par erreur)
- **Push protection** : ON (bloque le push avant qu'un secret n'arrive sur GitHub)
- **Code scanning (CodeQL)** : ON (default setup, OWASP Top 10, weekly + a chaque PR)

## Templates et reviewers

- **PR template** (`.github/PULL_REQUEST_TEMPLATE.md`) -- chaque PR pre-remplie avec Resume / Changements / Comment tester / Checklist
- **CODEOWNERS** (`.github/CODEOWNERS`) -- reviewers auto par chemin (back -> JB, front -> Lorelei, partage -> les deux)

## Reste a faire manuellement

### Inviter Lorelei comme Owner de l'org

Le scope `admin:org` n'etait pas dans le token `gh` quand j'ai essaye, donc a faire dans l'UI :

**https://github.com/orgs/nextquest-team/people > Invite member > Meii-Dicale > role: Owner**

Owner = elle peut tout faire (settings de l'org, ajout de repos, etc.). Pas d'invitation a accepter pour les changements de role apres ca.

### Re-verifier que la CodeQL passe

Le workflow `.github/workflows/codeql.yml` est custom. Avec le default-setup active aussi, GitHub utilise les deux. Si conflit :

**Settings > Code security and analysis > Code scanning > Default setup > Disable** (laisser uniquement le workflow custom).

---

## Commandes de verification

```bash
# Lister les rulesets actifs
gh api repos/nextquest-team/NextQuest/rulesets

# Detail d'un ruleset
gh api repos/nextquest-team/NextQuest/rulesets/15709531

# Etat securite
gh api repos/nextquest-team/NextQuest --jq '.security_and_analysis'

# Tester la protection : tenter un push direct sur develop -> doit etre rejete
git checkout develop && git push  # rejected
```
