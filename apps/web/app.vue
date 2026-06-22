<script setup lang="ts">
</script>

<template>
  <v-app theme="nextquest">
    <!-- Fond fixe : ne scrolle pas, ne se répète pas quelle que soit la hauteur de la page -->
    <div class="app-bg" aria-hidden="true" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </v-app>
</template>

<style>
.app-bg {
  position: fixed;
  inset: 0;
  background-color: var(--nq-beige);
  background-image: url('/images/backgrounds/fond.png');
  background-size: cover;
  background-position: center top;
  pointer-events: none;
  z-index: -1;
}

/* Le wrapper Vuetify doit être au-dessus du fond fixe */
.v-application__wrap {
  position: relative;
  z-index: 0;
  background: transparent !important;
}
</style>
