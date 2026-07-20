<script setup lang="ts">
definePageMeta({ middleware: 'guest', layout: 'plain' })

const { mdAndUp } = useDisplay()
</script>

<template>
  <AuthRegisterDesktop v-if="mdAndUp" />
  <AuthRegisterMobile v-else />
</template>
