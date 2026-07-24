<script setup lang="ts">
const props = defineProps<{
  screenshots: string[]
  index: number | null
  alt: string
}>()

const emit = defineEmits<{
  'update:index': [value: number | null]
}>()

const { t } = useI18n()

const open = computed(() => props.index !== null)
const current = computed(() => (props.index !== null ? props.screenshots[props.index] : null))

function close() {
  emit('update:index', null)
}

function prev() {
  if (props.index === null) return
  emit('update:index', (props.index - 1 + props.screenshots.length) % props.screenshots.length)
}

function next() {
  if (props.index === null) return
  emit('update:index', (props.index + 1) % props.screenshots.length)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'ArrowRight') next()
}

// Focus-trap + Echap (WCAG 2.4.3, 2.1.2) : voir useFocusTrap.ts
const modalBox = ref<HTMLElement | null>(null)
useFocusTrap(modalBox, () => open.value, close)
</script>

<template>
  <Transition name="modal">
    <div
      v-if="open"
      class="ssm__backdrop"
      role="dialog"
      aria-modal="true"
      :aria-label="alt"
      @click.self="close"
      @keydown="onKeydown"
    >
      <div ref="modalBox" class="ssm__box">
        <button class="ssm__close" :aria-label="t('gameDetail.screenshotClose')" @click="close">
          <v-icon size="24">mdi-close</v-icon>
        </button>

        <button
          v-if="screenshots.length > 1"
          class="ssm__nav ssm__nav--prev"
          :aria-label="t('gameDetail.screenshotPrev')"
          @click="prev"
        >
          <v-icon size="28">mdi-chevron-left</v-icon>
        </button>

        <img v-if="current" :src="current" :alt="alt" class="ssm__img" />

        <button
          v-if="screenshots.length > 1"
          class="ssm__nav ssm__nav--next"
          :aria-label="t('gameDetail.screenshotNext')"
          @click="next"
        >
          <v-icon size="28">mdi-chevron-right</v-icon>
        </button>

        <p v-if="screenshots.length > 1" class="ssm__counter">
          {{ t('gameDetail.screenshotCounter', { current: (index ?? 0) + 1, total: screenshots.length }) }}
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.ssm__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(var(--nq-scrim-rgb), 0.8);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.ssm__box {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  max-height: 100%;
}

.ssm__img {
  max-width: 100%;
  max-height: 82dvh;
  border-radius: 8px;
  object-fit: contain;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.ssm__close {
  position: absolute;
  top: -44px;
  right: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--nq-white);
  padding: 6px;
  border-radius: 6px;
  opacity: 0.85;
  transition: opacity 0.1s;
}
.ssm__close:hover { opacity: 1; }

.ssm__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(var(--nq-black-rgb), 0.35);
  border: none;
  cursor: pointer;
  color: var(--nq-white);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s;
}
.ssm__nav:hover { background: rgba(var(--nq-black-rgb), 0.55); }
.ssm__nav--prev { left: -8px; }
.ssm__nav--next { right: -8px; }

@media (max-width: 640px) {
  .ssm__nav--prev { left: 4px; }
  .ssm__nav--next { right: 4px; }
}

.ssm__counter {
  position: absolute;
  bottom: -32px;
  left: 50%;
  transform: translateX(-50%);
  color: var(--nq-white);
  font-family: var(--nq-font);
  font-size: 0.85rem;
  opacity: 0.85;
  margin: 0;
  white-space: nowrap;
}

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
