<script setup lang="ts">
import { watch } from 'vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; restored: [] }>()

const { t } = useI18n()
const { exclusions, loading, fetchExclusions, restore } = useExclusions()

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) fetchExclusions()
  },
)

async function onRestore(gameId: string) {
  const ok = await restore(gameId)
  if (ok) emit('restored')
}
</script>

<template>
  <Transition name="modal">
    <div
      v-if="open"
      class="gl-modal__backdrop"
      role="dialog"
      aria-modal="true"
      :aria-label="t('gameList.exclusions.title')"
      @click.self="emit('close')"
    >
      <div class="gl-modal__box">
        <div class="gl-modal__header">
          <h2 class="gl-modal__title">{{ t('gameList.exclusions.title') }}</h2>
          <button class="gl-modal__close" :aria-label="t('profil.cancel')" @click="emit('close')">
            <v-icon size="20">mdi-close</v-icon>
          </button>
        </div>

        <p class="gl-excl__hint">{{ t('gameList.exclusions.hint') }}</p>

        <div class="gl-excl__content">
          <div v-if="loading" class="gl-excl__state">
            <v-progress-circular indeterminate size="28" color="#5c3317" />
          </div>

          <div v-else-if="exclusions.length === 0" class="gl-excl__state">
            <v-icon size="40" color="#a07850">mdi-check-circle-outline</v-icon>
            <p class="gl-excl__state-text">{{ t('gameList.exclusions.empty') }}</p>
          </div>

          <div v-else class="gl-excl__list">
            <div v-for="game in exclusions" :key="game.gameId" class="gl-excl__card">
              <div class="gl-excl__cover">
                <img v-if="game.coverUrl" :src="game.coverUrl" :alt="game.title" class="gl-excl__cover-img" />
                <div v-else class="gl-excl__cover-ph">
                  <v-icon size="26" color="#a07850">mdi-gamepad-variant</v-icon>
                </div>
              </div>
              <p class="gl-excl__name">{{ game.title }}</p>
              <button class="gl-excl__restore" @click="onRestore(game.gameId)">
                {{ t('gameList.exclusions.restore') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.gl-modal__backdrop {
  position: fixed;
  inset: 0;
  background: rgba(30, 14, 4, 0.55);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.gl-modal__box {
  background: var(--nq-cream, #f8f4ea);
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  max-height: 80dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(58, 26, 10, 0.2);
}

.gl-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.25rem 0;
  flex-shrink: 0;
}

.gl-modal__title {
  font-family: var(--nq-font);
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--nq-brown-dark, #3a1a0a);
  margin: 0;
}

.gl-modal__close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--nq-brown, #5c3317);
  padding: 4px;
  border-radius: 4px;
  opacity: 0.7;
  transition: opacity 0.1s;
}
.gl-modal__close:hover { opacity: 1; }

.gl-excl__hint {
  font-family: var(--nq-font);
  font-size: 0.82rem;
  color: rgba(58, 26, 10, 0.6);
  margin: 0.75rem 1.25rem 0;
  flex-shrink: 0;
}

.gl-excl__content {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1.25rem 1.25rem;
}

.gl-excl__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem 1rem;
  text-align: center;
}
.gl-excl__state-text {
  font-family: var(--nq-font);
  font-size: 0.9rem;
  color: rgba(58, 26, 10, 0.6);
  margin: 0;
}

.gl-excl__list { display: flex; flex-direction: column; gap: 8px; }

.gl-excl__card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  border-radius: 8px;
  background: rgba(92, 51, 23, 0.05);
}

.gl-excl__cover {
  width: 40px;
  height: 54px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(92, 51, 23, 0.08);
}
.gl-excl__cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gl-excl__cover-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }

.gl-excl__name {
  flex: 1;
  min-width: 0;
  font-family: var(--nq-font);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--nq-brown-dark, #3a1a0a);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gl-excl__restore {
  flex-shrink: 0;
  font-family: var(--nq-font);
  font-size: 0.82rem;
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: #edc78e;
  background: var(--nq-brown, #5c3317);
  transition: background 0.1s;
}
.gl-excl__restore:hover { background: var(--nq-brown-dark, #3a1a0a); }

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
