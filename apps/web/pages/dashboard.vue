<script setup lang="ts">
import { useDisplay } from 'vuetify'

// SSR désactivé : page privée, les données utilisateur ne sont disponibles
// qu'après restauration de session côté client (plugin auth.client.ts).
// Pré-rendre avec un user null produit un mismatch d'hydratation.
definePageMeta({ ssr: false, layout: 'plain' })

const { mobile } = useDisplay()
const { user, logout, fetchProfile } = useAuth()

const username = computed(() => user.value?.displayName ?? user.value?.username ?? '')

// Le DTO /auth/register et /auth/refresh est réduit et ne contient pas
// onboardingCompleted. On appelle fetchProfile() (/api/users/me) dès que
// l'utilisateur arrive sur le dashboard pour hydrater le store complet.
// L'overlay réagit en temps réel via son watch sur show.
onMounted(() => {
  if (user.value) fetchProfile()
})
</script>

<template>
  <DashboardMobile
    v-if="mobile"
    :username="username"
    @logout="logout"
  />
  <DashboardDesktop
    v-else
    :username="username"
    @logout="logout"
  />
  <DashboardOnboardingOverlay />
</template>
