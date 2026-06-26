<script setup lang="ts">
const props = defineProps<{
  to?: string
}>()

const router = useRouter()

function handleClick() {
  if (props.to) navigateTo(props.to)
  else router.back()
}
</script>

<template>
  <UiPatchButton variant="back" @click="handleClick">
    <v-icon>mdi-arrow-left</v-icon>
  </UiPatchButton>
</template>
