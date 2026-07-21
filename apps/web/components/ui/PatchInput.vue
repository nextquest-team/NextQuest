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
   tricoté de la page, sans limite visible. Bordure ≥ 3:1 sur les deux fonds.
   Portée directement sur .v-field__input (le <input> réel) plutôt que sur
   .v-field (le wrapper) : certains scanners (Silktide) inspectent le
   contrôle de formulaire au sens strict et ne créditent pas une bordure
   posée deux niveaux plus haut dans le DOM. 12px = rayon résolu de
   `rounded="lg"` sur ce thème Vuetify (border-radius n'étant pas hérité). */
:deep(.v-field__input) {
  border: 1.5px solid var(--nq-brown-mid);
  border-radius: 12px;
}

/* Champs avec icône en fin (œil mot de passe) : .v-field__append-inner est
   un sibling du <input>, en dehors de son rectangle. On répartit la même
   bordure sur les deux pour obtenir un cadre visuellement continu, sans
   ligne verticale parasite entre le texte et l'icône. Le margin/padding
   négatif compense le padding-right de .v-field (12px, réservé à l'icône)
   pour que le bord droit de l'icône rejoigne exactement celui du champ. */
:deep(.v-field--appended .v-field__input) {
  border-right: none;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

:deep(.v-field--appended .v-field__append-inner) {
  border: 1.5px solid var(--nq-brown-mid);
  border-left: none;
  border-top-right-radius: 12px;
  border-bottom-right-radius: 12px;
  margin-right: -12px;
  padding-right: 12px;
  box-sizing: border-box;
}
</style>
