<script setup lang="ts">
definePageMeta({ ssr: false })

const { mobile } = useDisplay()

const gameList = useGameList()
provide('gameList', gameList)
onMounted(gameList.init)
</script>

<template>
  <ClientOnly>
    <GameListMobile v-if="mobile" />
    <GameListDesktop v-else />
  </ClientOnly>
</template>
