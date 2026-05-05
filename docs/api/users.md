# API Users -- documentation pour le front

Module `users` du backend. Toutes les routes sont sous `/api/users/me` et exigent un access token JWT en `Authorization: Bearer <token>`.

Le token est obtenu via `/api/auth/register`, `/api/auth/login` ou apres un OAuth callback. Dure 15 min, renouvelable via `/api/auth/refresh` (cookie HttpOnly).

Swagger UI complet : <http://localhost:3000/docs>

## DTO public `User`

Format renvoye par toutes les routes qui exposent un user (`/auth/me`, `/api/users/me`, PATCH /api/users/me).

```ts
type User = {
  id: string;                       // UUID
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  locale: "fr" | "en";
  visibility: "private" | "friends_only" | "public";
  emailVerified: boolean;
  onboardingCompleted: boolean;     // false a la creation, true apres POST /onboarding/complete
  createdAt: string;                // ISO 8601
};
```

Champs **jamais exposes** au client : `passwordHash`, `failedLoginAttempts`, `lockedUntil`, `deletedAt`, `role` (le role est dans le JWT lui-meme), `emailVerifiedAt`.

---

## `GET /api/users/me`

Recupere le profil du user authentifie. A appeler apres login/register, apres un refresh de page, ou pour rafraichir le state apres un PATCH.

### Reponse 200

Body : objet `User` (cf. plus haut).

### Erreurs

| Code | Cas |
|------|-----|
| 401  | Pas de token, token expire ou invalide |
| 404  | User authentifie mais soft-delete (cas marginal -- compte supprime entre-temps) |

### Exemple curl

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/users/me
```

### Note

`GET /api/auth/me` renvoie strictement le meme payload. Les deux endpoints sont equivalents fonctionnellement, garde celui qui te parait le plus naturel selon le contexte (auth pour le post-login, users pour les pages settings/profil).

---

## `PATCH /api/users/me`

Edite le profil. Tous les champs sont optionnels mais **au moins un** doit etre fourni (sinon 400).

### Body

```ts
{
  displayName?: string;        // 1 a 50 caracteres, pas vide
  avatarUrl?: string;          // URL valide, max 2048 caracteres
  bio?: string;                // max 500 caracteres, "" autorise pour reset
  locale?: "fr" | "en";
  visibility?: "private" | "friends_only" | "public";
}
```

Bornes alignees sur la BDD. Toute violation -> 400 avec details Zod.

### Reponse 200

Objet `User` mis a jour (le DTO complet, pas juste les champs modifies).

### Erreurs

| Code | Cas |
|------|-----|
| 400  | Validation Zod : body vide, displayName vide ou > 50, avatarUrl pas une URL ou > 2048, bio > 500, locale ou visibility hors enum |
| 401  | Pas de token |

Format d'erreur 400 :

```json
{
  "error": "Validation Error",
  "details": [
    { "field": "avatarUrl", "message": "Invalid url" }
  ]
}
```

### Exemples curl

```bash
# Modifier juste le display name
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Jean-Bap"}' \
  http://localhost:3000/api/users/me

# Modifier plusieurs champs
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Jean","bio":"Joueur PC depuis 1998","locale":"fr","visibility":"friends_only"}' \
  http://localhost:3000/api/users/me

# Reset de la bio (chaine vide)
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio":""}' \
  http://localhost:3000/api/users/me
```

### Limitations connues

Pas d'upload d'avatar dans cette spec. `avatarUrl` n'accepte que des URLs (typiquement celles fournies par les OAuth providers Google/Microsoft). L'upload custom sera ajoute dans une spec dediee profil/settings post-MVP. Pas non plus de moyen d'effacer `displayName` ou `avatarUrl` via cette route (validations strictes). Si Lorelei en a besoin, on ajoutera un endpoint dedie.

---

## `POST /api/users/me/onboarding/complete`

Marque le tour d'onboarding comme termine. **Idempotent** : un appel sur un user deja a `true` renvoie 200 sans erreur.

### Body

Aucun.

### Reponse 200

```json
{ "onboardingCompleted": true }
```

### Erreurs

| Code | Cas |
|------|-----|
| 401  | Pas de token |

### Exemple curl

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/users/me/onboarding/complete
```

### Note

Apres cet appel, `GET /api/users/me` (et `GET /auth/me`) renverra `onboardingCompleted: true`.

---

## Flow d'onboarding cote front

Vue d'ensemble du flow attendu, indicatif. Tu pilotes les etapes UX de ton cote (le back ne connait pas les etapes du tour, juste l'etat binaire `onboardingCompleted`).

```
1. User cree un compte (POST /api/auth/register ou OAuth callback)
   -> recoit accessToken + user (onboardingCompleted: false)

2. Front detecte onboardingCompleted=false -> declenche le tour guide
   (chaque etape geree par ton store Pinia/Vue, pas d'appel back en cours de tour)

3. Pendant le tour, optionnellement :
   - PATCH /api/users/me pour completer le profil (displayName, avatarUrl, locale, visibility, bio)
   - Ces appels sont independants de l'etat onboarding

4. A la fin du tour, le front appelle :
   POST /api/users/me/onboarding/complete

5. Le flag passe a true en BDD. Au prochain login, GET /auth/me renvoie onboardingCompleted=true
   -> le front sait qu'il faut PAS relancer le tour.
```

### Cas de skip

Si l'user clique "passer le tour", le front fait juste l'appel `POST /onboarding/complete` (le back ne distingue pas skip vs complete). Si tu veux faire de l'analytics dessus, track cote front (PostHog ou autre).

### Reset du tour pour debug

Pas de route dediee. Si tu en as besoin pour tester, je l'ajoute (`POST /api/users/me/onboarding/reset` qui repasse le flag a `false`).

---

## Etapes futures non couvertes par cette spec

A noter pour eviter les surprises : les routes ci-dessous **n'existent pas encore**, elles seront ajoutees dans des specs dediees.

- Upload d'avatar custom (post-MVP, spec profil/settings)
- Suppression de compte `DELETE /api/users/me` (spec RGPD)
- Profil public d'un autre user `GET /api/users/:id` (avec le module social)
- Reinitialiser l'onboarding (a la demande)
- Connexion plateformes gaming Steam/PSN/Xbox (Spec B import bibliothequee, prochaine etape backend)
