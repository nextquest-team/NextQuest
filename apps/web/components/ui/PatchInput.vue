<script setup lang="ts">
const { t } = useI18n()

const props = defineProps<{
  label: string
  modelValue: string
  type?: string
  placeholder?: string
  rules?: ((v: string) => string | true)[]
  error?: string
  autocomplete?: string
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
      :label="label"
      :type="isPassword && !showPassword ? 'password' : 'text'"
      :placeholder="placeholder"
      :rules="rules"
      :error-messages="error"
      :autocomplete="autocomplete"
      class="nq-input"
      variant="solo"
      bg-color="rgba(248, 244, 234, 0.92)"
      rounded="lg"
      hide-details="auto"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <template v-if="isPassword" #append-inner>
        <v-icon
          :icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          role="button"
          tabindex="0"
          :aria-label="showPassword ? t('auth.fields.hidePassword') : t('auth.fields.showPassword')"
          @click="showPassword = !showPassword"
          @keydown.enter.space.prevent="showPassword = !showPassword"
        />
      </template>
    </v-text-field>
  </div>
</template>

<style scoped>
/* Le <span class="nq-label"> ci-dessus est déjà le label visible : celui de Vuetify
   (nécessaire pour l'association aria-labelledby native) est masqué visuellement. */
:deep(.v-field-label) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Agrandit la zone cliquable du toggle œil à ~44px sans changer sa taille visuelle (24px) */
:deep(.v-field__append-inner .v-icon) {
  position: relative;
  cursor: pointer;
}

:deep(.v-field__append-inner .v-icon::before) {
  content: '';
  position: absolute;
  inset: -10px;
}

/* WCAG 1.4.11 : le champ (fond crème translucide) se fondait dans le fond
   tricoté de la page, sans limite visible. Bordure ≥ 3:1 sur les deux fonds. */
:deep(.v-field) {
  border: 1.5px solid var(--nq-brown-mid);
}
</style>
