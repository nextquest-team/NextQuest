<script setup lang="ts">
import { useDisplay } from 'vuetify'

const { mobile } = useDisplay()
const { user, logout } = useAuth()

const username = computed(() => user.value?.displayName ?? user.value?.username ?? '')
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
</template>
