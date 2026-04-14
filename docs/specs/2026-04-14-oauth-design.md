# OAuth Backend -- Google + Microsoft

**Date :** 14 avril 2026
**Par :** Jean-Baptiste
**Statut :** Valide

## Contexte

L'authentification email/password est en place (register, login, refresh token rotation, logout). Le MVP requiert OAuth Google et Microsoft. Apple sera ajoute plus tard, l'architecture doit le supporter sans modification structurelle.

Le front (Nuxt 3, Lorelei) est web responsive mobile-first. L'app mobile native viendra apres le MVP.

## Flow OAuth (Authorization Code Flow cote serveur)

```
1. Front:  GET /api/auth/oauth/:provider
2. Back:   Genere URL d'autorisation + state CSRF (cookie HttpOnly)
3. Back:   Renvoie { url: "https://accounts.google.com/..." }
4. Front:  Redirige le navigateur vers l'URL
5. User:   S'authentifie chez le provider
6. Provider: Redirige vers GET /api/auth/oauth/:provider/callback?code=...&state=...
7. Back:   Verifie state, echange code contre tokens provider
8. Back:   Extrait profil (email, nom, avatar)
9. Back:   Cree ou lie le compte, cree session NextQuest
10. Back:  Redirige vers le front avec access token + refresh token en cookie
```

## Endpoints

### Initiation OAuth

```
GET /api/auth/oauth/:provider
```

- `provider` : `google` ou `microsoft`
- Genere un `state` UUID, le stocke en cookie HttpOnly (5 min TTL)
- Renvoie `{ url: string }` -- l'URL d'autorisation du provider
- Erreur 400 si provider non supporte

### Callback OAuth

```
GET /api/auth/oauth/:provider/callback?code=...&state=...
```

- Verifie le `state` contre le cookie (protection CSRF)
- Echange le `code` contre des tokens provider (server-to-server)
- Extrait le profil utilisateur depuis le provider
- Execute la logique find-or-create (voir section suivante)
- Cree une session NextQuest (JWT access + refresh token)
- Redirige vers `{OAUTH_REDIRECT_URL}?token={accessToken}` (le refresh token est en cookie HttpOnly)
- En cas d'erreur : redirige vers `{OAUTH_REDIRECT_URL}?error={code}`

### Liaison de compte (authentifie)

```
POST /api/auth/oauth/:provider/link
```

- Necessite un access token valide (header Authorization)
- Initie un flow OAuth pour lier un nouveau provider au compte existant
- Renvoie `{ url: string }`

Le callback detecte qu'il s'agit d'un link (via un flag dans le cookie state) et lie le provider au compte au lieu de creer/login.

Erreurs :
- 409 si le provider est deja lie a un autre compte
- 409 si l'utilisateur a deja ce provider lie

### Suppression de liaison

```
DELETE /api/auth/oauth/:provider/link
```

- Necessite un access token valide
- Supprime l'entree `auth_providers` pour ce provider
- Erreur 400 si c'est le seul moyen de connexion (pas de password ET pas d'autre provider)
- Erreur 404 si le provider n'est pas lie

## Logique find-or-create (callback)

A la reception du profil OAuth du provider :

1. Chercher dans `auth_providers` : `(provider, provider_id)` existe ?
   - Oui --> login direct, creer session
2. Chercher dans `users` : email du provider existe dans `users.email` ?
   - Oui --> lier le provider au compte existant, creer session
3. Sinon --> creer un nouveau user (sans password) + lier le provider, creer session

Le user cree via OAuth a `password_hash = null` et `email_verified = true` (l'email est verifie par le provider).

## Securite

| Mesure | Detail |
|--------|--------|
| State CSRF | UUID en cookie HttpOnly + SameSite=Lax, TTL 5 min, compare au retour callback |
| Tokens provider | Jamais stockes en BDD. Utilises une seule fois pour recup le profil |
| Client secret | Stocke en variable d'env, jamais expose au front |
| Redirect callback | URL fixe enregistree chez chaque provider, non modifiable par le client |
| Redirect front | Validee contre `OAUTH_REDIRECT_URL` (env var) |
| Email trust | On fait confiance a l'email du provider (Google et Microsoft verifient les emails) |

## Configuration providers

### Google

- Authorization URL : `https://accounts.google.com/o/oauth2/v2/auth`
- Token URL : `https://oauth2.googleapis.com/token`
- User info URL : `https://www.googleapis.com/oauth2/v2/userinfo`
- Scopes : `openid email profile`

### Microsoft

- Authorization URL : `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
- Token URL : `https://login.microsoftonline.com/common/oauth2/v2.0/token`
- User info URL : `https://graph.microsoft.com/v1.0/me`
- Scopes : `openid email profile User.Read`
- Tenant : `common` (comptes perso + pro/edu)

## Structure fichiers

```
apps/api/src/modules/auth/
  auth.routes.ts              # inchange
  auth.service.ts             # inchange
  auth.schemas.ts             # ajouter schemas OAuth
  oauth/
    oauth.routes.ts           # GET /:provider, GET /:provider/callback, POST/DELETE /:provider/link
    oauth.service.ts          # find-or-create, link, unlink, state management
    oauth.config.ts           # URLs, scopes, client IDs par provider
    providers/
      google.ts               # exchangeCode() + getUserProfile() pour Google
      microsoft.ts            # exchangeCode() + getUserProfile() pour Microsoft
```

Chaque fichier `providers/*.ts` exporte deux fonctions :
- `exchangeCode(code, redirectUri)` : echange le code contre un access token provider
- `getUserProfile(accessToken)` : renvoie `{ providerId, email, displayName, avatarUrl }`

Ajouter un provider (Apple, Discord) = creer le fichier + ajouter la config dans `oauth.config.ts`.

## Variables d'environnement

```env
# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Microsoft OAuth
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# URL du front apres OAuth (redirect finale)
OAUTH_REDIRECT_URL=http://localhost:3001
```

## Impact sur l'existant

Aucune modification du schema BDD. La table `auth_providers` et la table `users` (password_hash nullable) supportent deja le design.

Le module auth email/password (auth.routes.ts, auth.service.ts) reste intact.

## Ajout futur d'Apple

L'architecture est prete. Particularites Apple a prevoir :
- Apple ne renvoie email/nom qu'au premier consentement : stocker au premier callback
- Necessite un Apple Developer Account (99$/an) et un Services ID
- Le flow reste identique (Authorization Code Flow)
