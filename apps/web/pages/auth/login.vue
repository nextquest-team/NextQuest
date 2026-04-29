<script setup lang="ts">
definePageMeta({ middleware: 'guest' })

const { login, isLoading, error } = useAuth()

const email = ref('')
const password = ref('')
const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)

const emailRules = [
  (v: string) => !!v || 'Email requis',
  (v: string) => /.+@.+\..+/.test(v) || 'Email invalide',
]

const passwordRules = [
  (v: string) => !!v || 'Mot de passe requis',
  (v: string) => v.length >= 8 || '8 caractères minimum',
]

async function handleLogin() {
  const { valid } = await form.value!.validate()
  if (!valid) return
  try {
    await login(email.value, password.value)
  } catch {
    // L'erreur est déjà gérée dans useAuth et exposée via `error`
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-content">
      <!-- Bouton retour -->
      <div class="auth-header">
        <UiPatchButton variant="back" @click="navigateTo('/')">
          <v-icon>mdi-arrow-left</v-icon>
        </UiPatchButton>
      </div>

      <v-form ref="form" @submit.prevent="handleLogin">
        <div class="auth-fields">
          <UiPatchInput
            v-model="email"
            label="Adresse Mail"
            type="email"
            placeholder="exemple@email.com"
            :rules="emailRules"
          />

          <UiPatchInput
            v-model="password"
            label="Mot de passe"
            type="password"
            :rules="passwordRules"
          />
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <NuxtLink to="/auth/forgot-password" class="auth-forgot">
          Mot de passe oublié
        </NuxtLink>

        <UiPatchButton
          variant="primary"
          type="submit"
          size="large"
          block
          :loading="isLoading"
        >
          Connexion
        </UiPatchButton>
      </v-form>

      <!-- Connexions sociales -->
      <!-- TODO: implémenter OAuth quand les routes backend sont prêtes (JB) -->
      <div class="social-grid">
        <UiPatchButton variant="social" color="#4285F4" class="social-btn" disabled>
          Connect with Google
        </UiPatchButton>

        <UiPatchButton variant="social" color="#8B1A2A" class="social-btn" disabled>
          Connect with Apple
        </UiPatchButton>

        <UiPatchButton variant="social" color="#0078D4" class="social-btn" disabled>
          Connect with Microsoft
        </UiPatchButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1.5rem;
}

.auth-content {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.auth-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}

.auth-fields {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-bottom: 1rem;
}

.auth-forgot {
  display: block;
  text-align: center;
  font-family: var(--nq-font);
  font-variant: small-caps;
  font-size: 0.9rem;
  color: var(--nq-red);
  text-decoration: none;
  letter-spacing: 0.05em;
  margin-bottom: 1.5rem;
}

.auth-forgot:hover {
  text-decoration: underline;
}

.auth-error {
  font-family: var(--nq-font);
  color: var(--nq-red);
  font-size: 0.85rem;
  text-align: center;
  margin-bottom: 0.75rem;
}

.social-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

/* Le 3e bouton (Microsoft) prend toute la largeur */
.social-grid .social-btn:last-child:nth-child(odd) {
  grid-column: 1 / -1;
}
</style>
