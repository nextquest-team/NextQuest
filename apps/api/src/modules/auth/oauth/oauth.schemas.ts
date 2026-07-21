// Schemas de reponse OAuth (documentation + serialisation OpenAPI).
import { z } from "zod";
import { validationErrorSchema, errorResponseSchema } from "../../../lib/openapi.js";

// Reponse de demarrage de flow OAuth (initiation ou liaison) : l'URL
// d'autorisation du provider que le front doit ouvrir/rediriger.
export const oauthAuthorizationUrlSchema = z
  .object({
    url: z.string().describe("URL d'autorisation du provider OAuth"),
  })
  .describe("URL d'autorisation OAuth");

// 400 mixte : le parametre provider invalide passe par l'error handler commun
// (forme validationErrorSchema), mais les erreurs metier de ces routes (provider
// non configure, seule methode de connexion) sont renvoyees directement par le
// handler avec { error } sans passer par cet error handler. Les deux formes sont
// donc possibles sur ce code.
export const oauthBadRequestSchema = z
  .union([validationErrorSchema, errorResponseSchema])
  .describe("Parametre invalide ou erreur metier OAuth");
