<script setup lang="ts">
const { t } = useI18n()

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
  <UiPatchButton variant="back" :aria-label="t('nav.back')" @click="handleClick">
    <v-icon aria-hidden="true">mdi-arrow-left</v-icon>
  </UiPatchButton>
</template>
