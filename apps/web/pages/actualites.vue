<script setup lang="ts">
definePageMeta({ ssr: false })

const { mobile } = useDisplay()
</script>

<template>
  <ClientOnly>
    <ActualitesMobile v-if="mobile" />
    <ActualitesDesktop v-else />
  </ClientOnly>
</template>
