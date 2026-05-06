<script setup lang="ts">
import { useDisplay } from 'vuetify'

// SSR désactivé : page privée, les données utilisateur ne sont disponibles
// qu'après restauration de session côté client (plugin auth.client.ts).
// Pré-rendre avec un user null produit un mismatch d'hydratation.
definePageMeta({ ssr: false })

const { mobile } = useDisplay()
const { user, logout } = useAuth()

const username = computed(() => user.value?.displayName ?? user.value?.username ?? '')
</script>

<template>
  <ClientOnly>
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
  </ClientOnly>
</template>
