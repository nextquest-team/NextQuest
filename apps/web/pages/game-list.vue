<script setup lang="ts">
definePageMeta({ ssr: false })

const { mobile } = useDisplay()
</script>

<template>
  <ClientOnly>
    <GameListMobile v-if="mobile" />
    <GameListDesktop v-else />
  </ClientOnly>
</template>
