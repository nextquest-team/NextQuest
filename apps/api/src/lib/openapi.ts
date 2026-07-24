import { z } from "zod";

// Schemas de reponse d'erreur mutualises, alignes sur le format produit par
// l'error handler commun (voir lib/error-handler.ts). Ils servent a documenter
// les reponses d'erreur dans l'OpenAPI ET a serialiser ces reponses de facon
// coherente (le serializer Zod est actif globalement).

// 400 : erreur de validation des entrees (body / params / querystring).
export const validationErrorSchema = z
  .object({
    error: z.literal("Validation Error").describe("Libelle de l'erreur"),
    details: z
      .array(
        z.object({
          field: z.string().describe("Chemin du champ invalide (ex: email)"),
          message: z.string().describe("Raison de l'invalidite"),
        }),
      )
      .describe("Liste des champs invalides"),
  })
  .describe("Erreur de validation des entrees");

// Autres erreurs (401 / 403 / 404 / 409 / 410 / 413 / 422 / 429 / 500 / 502 / 503) : message seul.
// 410 = ressource definitivement close (ex: grace de restauration expiree), 413 = fichier trop
// volumineux (upload), 429 = rate limit depasse, 503 = service indisponible (ex: stockage objet).
export const errorResponseSchema = z
  .object({
    error: z.string().describe("Message d'erreur lisible"),
  })
  .describe("Erreur");

// 400 : deux formes reelles possibles selon l'origine de l'erreur.
// - validation des entrees (error handler commun) -> { error, details }
// - erreur metier levee par un handler (reply.code(400)) -> { error }
// L'union couvre les deux, ce que le serializer Zod doit accepter au runtime.
export const badRequestSchema = z
  .union([validationErrorSchema, errorResponseSchema])
  .describe("Requete invalide (erreur de validation ou erreur metier)");

type ErrorCode = 400 | 401 | 403 | 404 | 409 | 410 | 413 | 422 | 429 | 500 | 502 | 503;

// Schema associe a un code d'erreur : 400 = requete invalide (union), sinon message.
type ErrorSchemaFor<K extends ErrorCode> = K extends 400
  ? typeof badRequestSchema
  : typeof errorResponseSchema;

// Compose une portion du champ `response` d'une route pour les codes d'erreur
// demandes. 400 utilise le schema de validation, les autres le schema generique.
// Le generique preserve les cles LITTERALES ({ 401: ..., 404: ... }) : c'est
// indispensable pour que le type provider Zod autorise reply.code(401/404).
// Usage : response: { 200: okSchema, ...errorResponses(401, 404) }
export function errorResponses<C extends ErrorCode>(
  ...codes: C[]
): { [K in C]: ErrorSchemaFor<K> } {
  const map = {} as Record<number, z.ZodTypeAny>;
  for (const code of codes) {
    map[code] = code === 400 ? badRequestSchema : errorResponseSchema;
  }
  return map as { [K in C]: ErrorSchemaFor<K> };
}

// Reponse 204 No Content : pas de corps. On documente la reponse sans schema de
// contenu (z.null() serialise en corps vide et evite un schema de body errone).
export const noContentSchema = z.null().describe("Aucun contenu");
