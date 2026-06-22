<script setup lang="ts">
definePageMeta({ ssr: false })

const { mobile } = useDisplay()
</script>

<template>
  <ClientOnly>
    <GamesGameDetailMobile v-if="mobile" />
    <GamesGameDetailDesktop v-else />
  </ClientOnly>
</template>
