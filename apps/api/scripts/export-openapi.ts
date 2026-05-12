import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import Fastify from 'fastify'
import { registerSwagger } from '../src/plugins/swagger.js'
import { registerJwt } from '../src/plugins/jwt.js'
import { registerCookie } from '../src/plugins/cookie.js'
import { registerRateLimit } from '../src/plugins/rate-limit.js'
import { healthRoutes } from '../src/modules/health/health.routes.js'
import { authRoutes } from '../src/modules/auth/auth.routes.js'
import { oauthRoutes } from '../src/modules/auth/oauth/oauth.routes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../../.env') })

const app = Fastify({ logger: false })

async function main() {
  // Même ordre que server.ts — certaines routes appellent app.rateLimit()
  await registerSwagger(app)
  await registerJwt(app)
  await registerCookie(app)
  await registerRateLimit(app)

  await app.register(healthRoutes, { prefix: '/api' })
  await app.register(authRoutes, { prefix: '/api' })
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
