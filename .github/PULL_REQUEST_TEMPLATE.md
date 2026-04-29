<!--
Merci de remplir ce template avant de demander une review.
Pour les commits eux-memes, on suit Conventional Commits :
feat: / fix: / docs: / refactor: / test: / chore:
-->

## Resume

<!-- 2-3 lignes : qu'est-ce que cette PR change et pourquoi -->

## Changements principaux

<!-- Liste a puces des changements visibles. Detail technique inutile, le diff parle. -->

-
-
-

## Comment tester

<!--
Etapes concretes pour que le reviewer puisse verifier :
"git checkout cette-branche, pnpm install, pnpm dev, ouvrir X, faire Y, voir Z"
-->

- [ ]
- [ ]

## Captures / demos

<!-- Pour le front : screenshots ou GIF. Pour le back : extraits de payload, requete curl. Optionnel. -->

## Checklist

- [ ] La CI est verte (lint + typecheck + tests + build)
- [ ] J'ai mis a jour le journal de bord (`docs/journal-jb.md` ou celui de Lorelei)
- [ ] J'ai mis a jour le schema BDD (`docs/database/schema.dbml`) si modifie
- [ ] J'ai mis a jour le README ou les specs si necessaire
- [ ] J'ai pense au RGPD si je touche aux donnees utilisateur
- [ ] La branche est a jour avec `develop`
