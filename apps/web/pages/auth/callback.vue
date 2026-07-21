<script setup lang="ts">
// Page d'atterrissage après un flow OAuth (Google, Microsoft).
// L'API backend redirige ici avec ?token=<jwt> et place le refresh token
// dans un cookie httpOnly.
//
// Deux contextes possibles :
// 1. Popup (cas standard) : on postMessage le résultat au parent et on ferme
// 2. Plein écran (fallback popup bloquée) : on appelle fetchMe et on redirige

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

function isInPopup(): boolean {
  try {
    return !!window.opener && window.opener !== window && !window.opener.closed
  } catch {
    return false
  }
}

onMounted(async () => {
  const queryError = route.query.error as string | undefined
  const token = route.query.token as string | undefined

  // Cas 1 : on est dans une popup → on remonte le résultat au parent
  if (isInPopup()) {
    if (queryError) {
      window.opener.postMessage(
        { type: 'nq-oauth-error', message: oauthErrors[queryError] ?? 'Erreur OAuth' },
        window.location.origin,
      )
    } else if (token) {
      window.opener.postMessage(
        { type: 'nq-oauth-success', token },
        window.location.origin,
      )
    } else {
      window.opener.postMessage(
        { type: 'nq-oauth-error', message: 'Token manquant dans la redirection' },
        window.location.origin,
      )
    }
    window.close()
    return
  }

  // Cas 2 : plein écran (fallback) → on gère le flow ici
  if (queryError) {
    errorMessage.value = oauthErrors[queryError] ?? 'Erreur OAuth'
    return
  }

  if (!token) {
    errorMessage.value = 'Token manquant dans la redirection'
    return
  }

  const user = await fetchMe(token)
  if (!user) {
    errorMessage.value = 'Impossible de récupérer le profil utilisateur'
    return
  }

  await router.replace('/dashboard')
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
      <v-progress-circular aria-label="Connexion en cours" indeterminate color="primary" size="48" />
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
