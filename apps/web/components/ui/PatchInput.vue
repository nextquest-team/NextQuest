<script setup lang="ts">
const props = defineProps<{
  label: string
  modelValue: string
  type?: string
  placeholder?: string
  rules?: ((v: string) => string | true)[]
  error?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

const showPassword = ref(false)
const isPassword = computed(() => props.type === 'password')
</script>

<template>
  <div>
    <span class="nq-label">{{ label }}</span>
    <v-text-field
      :model-value="modelValue"
      :type="isPassword && !showPassword ? 'password' : 'text'"
      :placeholder="placeholder"
      :rules="rules"
      :error-messages="error"
      :append-inner-icon="isPassword ? (showPassword ? 'mdi-eye-off' : 'mdi-eye') : undefined"
      class="nq-input"
      variant="solo"
      bg-color="rgba(248, 244, 234, 0.92)"
      rounded="lg"
      hide-details="auto"
      @update:model-value="$emit('update:modelValue', $event)"
      @click:append-inner="showPassword = !showPassword"
    />
  </div>
</template>

<style scoped>
/* Agrandit la zone cliquable du toggle œil à ~44px sans changer sa taille visuelle (24px) */
:deep(.v-field__append-inner .v-icon--clickable) {
  position: relative;
}

:deep(.v-field__append-inner .v-icon--clickable::before) {
  content: '';
  position: absolute;
  inset: -10px;
}
</style>
