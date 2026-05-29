<script setup lang="ts">
const props = defineProps<{
  to?: string
}>()

function handleClick() {
  if (props.to) navigateTo(props.to)
}
</script>

<template>
  <UiPatchButton variant="back" @click="handleClick">
    <v-icon>mdi-arrow-left</v-icon>
  </UiPatchButton>
</template>
