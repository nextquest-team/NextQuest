<script setup lang="ts">
import { computed } from 'vue'
import type { ImportStatus } from '~/types/game'

const props = defineProps<{ open: boolean; status: ImportStatus | null }>()
const emit = defineEmits<{ background: []; close: [] }>()

const { t } = useI18n()

const total = computed(() => props.status?.total ?? 0)
const done = computed(() => props.status?.done ?? 0)
const percent = computed(() =>
  total.value > 0 ? Math.min(100, Math.round((done.value / total.value) * 100)) : 0,
)
const games = computed(() => props.status?.games ?? [])
</script>

<template>
  <Transition name="modal">
    <div
      v-if="open"
      class="gl-modal__backdrop"
      role="dialog"
      aria-modal="true"
      :aria-label="t('gameList.importProgress.title')"
    >
      <div class="gl-modal__box ip-modal">
        <!-- En-tete -->
        <div class="gl-modal__header">
          <h2 class="gl-modal__title">{{ t('gameList.importProgress.title') }}</h2>
          <button
            class="gl-modal__close"
            :aria-label="t('gameList.importProgress.background')"
            @click="emit('background')"
          >
            <v-icon size="20">mdi-close</v-icon>
          </button>
        </div>

        <div class="ip-modal__body">
          <p class="ip-modal__count">
            {{ t('gameList.importProgress.count', { done, total }) }}
          </p>

          <div
            class="ip-modal__bar"
            role="progressbar"
            :aria-valuenow="percent"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div class="ip-modal__bar-fill" :style="{ width: percent + '%' }" />
          </div>

          <!-- Grille de jaquettes : chaque vignette se remplit au fur et a mesure -->
          <div class="ip-modal__grid">
            <div v-for="g in games" :key="g.id" class="ip-modal__cell">
              <img
                v-if="g.coverUrl"
                :src="g.coverUrl"
                alt=""
                class="ip-modal__cover"
              />
              <div v-else class="ip-modal__placeholder">
                <v-icon size="22" color="#a07850">mdi-gamepad-variant</v-icon>
              </div>
            </div>
          </div>
        </div>

        <div class="ip-modal__footer">
          <button class="ip-modal__bg-btn" @click="emit('background')">
            {{ t('gameList.importProgress.background') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Coquille de modale alignee sur GameListAddModal (pas de composant modale partage). */
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
  max-width: 520px;
  max-height: 82dvh;
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
.gl-modal__close:hover {
  opacity: 1;
}

/* ── Corps ── */
.ip-modal__body {
  padding: 1rem 1.25rem 0;
  overflow-y: auto;
  flex: 1;
}

.ip-modal__count {
  font-family: var(--nq-font);
  font-size: 0.9rem;
  color: var(--nq-brown-dark, #3a1a0a);
  margin: 0 0 0.5rem;
}

.ip-modal__bar {
  height: 8px;
  border-radius: 999px;
  background: rgba(92, 51, 23, 0.12);
  overflow: hidden;
}

.ip-modal__bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--nq-brown, #5c3317), #c8963e);
  transition: width 0.3s ease;
}

.ip-modal__grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(58px, 1fr));
  gap: 8px;
  padding-bottom: 1rem;
}

.ip-modal__cell {
  aspect-ratio: 3 / 4;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(92, 51, 23, 0.08);
}

.ip-modal__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.ip-modal__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Pied ── */
.ip-modal__footer {
  padding: 0.75rem 1.25rem 1.25rem;
  flex-shrink: 0;
}

.ip-modal__bg-btn {
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: var(--nq-font);
  font-size: 0.9rem;
  color: var(--nq-brown-dark, #3a1a0a);
  background: rgba(92, 51, 23, 0.1);
  transition: background 0.1s;
}
.ip-modal__bg-btn:hover {
  background: rgba(92, 51, 23, 0.16);
}

/* ── Transition ── */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
