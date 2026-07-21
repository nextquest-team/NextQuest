<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ImportStatus } from '~/types/game'

const props = defineProps<{ open: boolean; status: ImportStatus | null }>()
// Pas de vraie "fermeture" ici : l'action utilisateur est de continuer
// l'import en arriere-plan (cf GameListDesktop/Mobile, qui ne cablent que
// @background). Echap fait donc la meme chose que le bouton.
const emit = defineEmits<{ background: [] }>()

const { t } = useI18n()

// Focus-trap + Echap (WCAG 2.4.3, 2.1.2) : voir useFocusTrap.ts
const modalBox = ref<HTMLElement | null>(null)
useFocusTrap(modalBox, () => props.open, () => emit('background'))

// Grille plafonnee : sur une grosse biblio (200+ jeux) on n'affiche pas tout,
// juste les jaquettes deja recuperees jusqu'a un maximum. Le loader indique
// que l'import continue en fond.
const MAX_TILES = 24
const covers = computed(() =>
  (props.status?.games ?? []).filter((g) => g.coverUrl).slice(0, MAX_TILES),
)
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
      <div ref="modalBox" class="gl-modal__box ip-modal">
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
          <!-- Indicateur de chargement (pas de compteur textuel) -->
          <div class="ip-modal__loader" aria-live="polite" :aria-label="t('gameList.importProgress.title')">
            <v-progress-circular indeterminate size="34" width="3" color="#5c3317" />
          </div>

          <!-- Jaquettes qui arrivent au fur et a mesure -->
          <div v-if="covers.length" class="ip-modal__grid">
            <div v-for="c in covers" :key="c.id" class="ip-modal__cell">
              <img :src="c.coverUrl!" alt="" class="ip-modal__cover" />
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
.gl-modal__close:hover { opacity: 1; }

/* ── Corps ── */
.ip-modal__body {
  padding: 1.5rem 1.25rem 0;
  overflow-y: auto;
  flex: 1;
}

.ip-modal__loader {
  display: flex;
  justify-content: center;
  padding: 0.5rem 0 1.25rem;
}

.ip-modal__grid {
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
.ip-modal__bg-btn:hover { background: rgba(92, 51, 23, 0.16); }

/* ── Transition ── */
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
