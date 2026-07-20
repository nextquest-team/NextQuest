<script setup lang="ts">
definePageMeta({ middleware: 'guest', layout: 'plain' })

const { mdAndUp } = useDisplay()
</script>

<template>
  <AuthLoginDesktop v-if="mdAndUp" />
  <AuthLoginMobile v-else />
</template>
