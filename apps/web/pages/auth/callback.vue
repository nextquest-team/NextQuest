<script setup lang="ts">
// Page d'atterrissage après un flow OAuth (Google, Microsoft).
// L'API backend redirige ici avec ?token=<jwt> et place le refresh token
// dans un cookie httpOnly. On stocke l'access token, on récupère le profil
// utilisateur via /auth/me, puis on redirige vers la home.

definePageMeta({ layout: false })

const route = useRoute()
const router = useRouter()
const { fetchMe } = useAuth()

const errorMessage = ref<string | null>(null)

const oauthErrors: Record<string, string> = {
  oauth_denied: 'Connexion annulée',
  invalid_state: 'Session expirée, réessayez',
  missing_params: 'Paramètres OAuth manquants',
  oauth_failed: 'Erreur lors de la connexion au provider',
}

onMounted(async () => {
  const queryError = route.query.error as string | undefined
  if (queryError) {
    errorMessage.value = oauthErrors[queryError] ?? 'Erreur OAuth'
    return
  }

  const token = route.query.token as string | undefined
  if (!token) {
    errorMessage.value = 'Token manquant dans la redirection'
    return
  }

  // Récupère le profil utilisateur (fetchMe stocke aussi token + user dans le store)
  const user = await fetchMe(token)

  if (!user) {
    errorMessage.value = 'Impossible de récupérer le profil utilisateur'
    return
  }

  // Nettoie l'URL (retire le token du query) et redirige vers la home
  // TODO: rediriger vers le dashboard quand la page existe
  await router.replace('/')
})
</script>

<template>
  <div class="callback-page">
    <div v-if="errorMessage" class="callback-error">
      <p>{{ errorMessage }}</p>
      <UiPatchButton variant="primary" @click="navigateTo('/auth/login')">
        Retour à la connexion
      </UiPatchButton>
    </div>
    <div v-else class="callback-loading">
      <v-progress-circular indeterminate color="primary" size="48" />
      <p>Connexion en cours…</p>
    </div>
  </div>
</template>

<style scoped>
.callback-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.callback-loading,
.callback-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  font-family: var(--nq-font);
  color: var(--nq-brown-dark);
  text-align: center;
}

.callback-error p {
  color: var(--nq-red);
  font-size: 1rem;
}
</style>
