<script setup lang="ts">
import type { TimelineTab } from '~/types/timeline'

const { mobile } = useDisplay()

const activeTab = ref<TimelineTab>('upcoming')

const timeline = useTimeline()
provide('timeline', timeline)
onMounted(() => timeline.fetchUpcoming())
</script>

<template>
  <ClientOnly>
    <TimelineMobile v-if="mobile" v-model:active-tab="activeTab" />
    <TimelineDesktop v-else v-model:active-tab="activeTab" />
  </ClientOnly>
</template>
