import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { validatorCompiler, serializerCompiler } from "fastify-type-provider-zod";
import { registerSwagger } from "../../../plugins/swagger.js";
import { healthRoutes } from "../health.routes.js";

// Pas de BDD ici : route health pure. On reconstitue le branchement reel
// (compilers Zod + swagger transform) car c'est la combinaison qui revele les
// schemas non-Zod incompatibles avec jsonSchemaTransform.
async function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await registerSwagger(app);
  await app.register(healthRoutes, { prefix: "/api" });
  await app.ready();
  return app;
}

describe("GET /api/health", () => {
  it("renvoie 200 avec status et timestamp", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
  });

  // Regression : avec un response schema en JSON Schema brut, jsonSchemaTransform
  // levait "Invalid schema passed" et app.swagger() echouait. Le schema Zod corrige ca.
  it("genere l'OpenAPI sans erreur et documente la route", async () => {
    const app = await buildApp();
    const spec = app.swagger() as {
      paths: Record<string, Record<string, unknown>>;
    };
    expect(spec.paths["/api/health"]).toBeDefined();
    expect(spec.paths["/api/health"].get).toBeDefined();
  });
});
