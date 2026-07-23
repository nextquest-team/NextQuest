import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import Fastify from 'fastify'
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod'
import { registerCors } from '../src/plugins/cors.js'
import { registerSwagger } from '../src/plugins/swagger.js'
import { registerJwt } from '../src/plugins/jwt.js'
import { registerCookie } from '../src/plugins/cookie.js'
import { registerRateLimit } from '../src/plugins/rate-limit.js'
import { healthRoutes } from '../src/modules/health/health.routes.js'
import { authRoutes } from '../src/modules/auth/auth.routes.js'
import { oauthRoutes } from '../src/modules/auth/oauth/oauth.routes.js'
import { usersRoutes } from '../src/modules/users/users.routes.js'
import { steamRoutes } from '../src/modules/platforms/steam/steam.routes.js'
import { collectionRoutes } from '../src/modules/collection/collection.routes.js'
import { recommendationsRoutes } from '../src/modules/recommendations/recommendations.routes.js'
import { igdbRoutes } from '../src/modules/games/igdb/igdb.routes.js'
import { followRoutes } from '../src/modules/games/follow/follow.routes.js'
import { gamesRoutes } from '../src/modules/games/games.routes.js'
import { platformsRoutes } from '../src/modules/referentials/platforms.routes.js'
import { genresRoutes } from '../src/modules/referentials/genres.routes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../../.env') })

const app = Fastify({ logger: false })

// Mêmes compilers que server.ts : sans eux, les schémas Zod des routes ne sont
// ni validés ni sérialisés correctement (la génération du spec échoue).
app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

async function main() {
  // Même ordre que server.ts — certaines routes appellent app.rateLimit()
  await registerCors(app)
  await registerSwagger(app)
  await registerJwt(app)
  await registerCookie(app)
  await registerRateLimit(app)

  await app.register(healthRoutes, { prefix: '/api' })
  await app.register(authRoutes, { prefix: '/api' })
  await app.register(usersRoutes, { prefix: '/api' })
  await app.register(steamRoutes, { prefix: '/api' })
  await app.register(collectionRoutes, { prefix: '/api' })
  await app.register(recommendationsRoutes, { prefix: '/api' })
  await app.register(igdbRoutes, { prefix: '/api' })
  await app.register(followRoutes, { prefix: '/api' })
  await app.register(gamesRoutes, { prefix: '/api' })
  await app.register(platformsRoutes, { prefix: '/api' })
  await app.register(genresRoutes, { prefix: '/api' })
  await app.register(oauthRoutes, { prefix: '/api/auth' })

  await app.ready()

  const spec = app.swagger()
  const outPath = resolve(__dirname, '../../../packages/shared/openapi.json')
  writeFileSync(outPath, JSON.stringify(spec, null, 2))
  console.log('✓ OpenAPI spec → packages/shared/openapi.json')

  await app.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
