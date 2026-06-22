<script setup lang="ts">
definePageMeta({ ssr: false })

const { mobile } = useDisplay()
</script>

<template>
  <ClientOnly>
    <ProfilMobile v-if="mobile" />
    <ProfilDesktop v-else />
  </ClientOnly>
</template>
