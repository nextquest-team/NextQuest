<script setup lang="ts">
definePageMeta({ ssr: false })

const { mobile } = useDisplay()
</script>

<template>
  <ClientOnly>
    <GamesCatalogGameCatalogDetailMobile v-if="mobile" />
    <GamesCatalogGameCatalogDetailDesktop v-else />
  </ClientOnly>
</template>
