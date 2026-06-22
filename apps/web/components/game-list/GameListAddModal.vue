<script setup lang="ts">
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const search = ref('')
</script>

<template>
  <Transition name="modal">
    <div v-if="open" class="gl-modal__backdrop" role="dialog" aria-modal="true" :aria-label="t('gameList.addModal.title')" @click.self="emit('close')">
      <div class="gl-modal__box">

        <!-- En-tête -->
        <div class="gl-modal__header">
          <h2 class="gl-modal__title">{{ t('gameList.addModal.title') }}</h2>
          <button class="gl-modal__close" :aria-label="t('profil.cancel')" @click="emit('close')">
            <v-icon size="20">mdi-close</v-icon>
          </button>
        </div>

        <!-- Recherche -->
        <div class="gl-modal__search-wrap">
          <v-icon size="18" class="gl-modal__search-icon">mdi-magnify</v-icon>
          <input
            v-model="search"
            class="gl-modal__search"
            :placeholder="t('gameList.addModal.searchPlaceholder')"
            type="search"
            autofocus
          />
        </div>

        <!-- Contenu — bientôt disponible -->
        <div class="gl-modal__coming-soon">
          <v-icon size="48" color="#a07850">mdi-database-search-outline</v-icon>
          <p class="gl-modal__coming-text">{{ t('gameList.addModal.comingSoon') }}</p>
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
  background: var(--nq-cream, #F8F4EA);
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  max-height: 80dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(58, 26, 10, 0.2);
}

/* ── En-tête ── */
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
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}

.gl-modal__close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--nq-brown, #5C3317);
  padding: 4px;
  border-radius: 4px;
  opacity: 0.7;
  transition: opacity 0.1s;
}

.gl-modal__close:hover { opacity: 1; }

/* ── Recherche ── */
.gl-modal__search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 1rem 1.25rem 0;
  background: rgba(92, 51, 23, 0.07);
  border-radius: 8px;
  padding: 8px 12px;
  flex-shrink: 0;
}

.gl-modal__search-icon { color: var(--nq-brown, #5C3317); opacity: 0.6; }

.gl-modal__search {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-family: var(--nq-font);
  font-size: 0.9rem;
  color: var(--nq-brown-dark, #3A1A0A);
}

.gl-modal__search::placeholder { color: rgba(58, 26, 10, 0.4); }

/* ── Coming soon ── */
.gl-modal__coming-soon {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem 1.5rem;
  text-align: center;
}

.gl-modal__coming-text {
  font-family: var(--nq-font);
  font-size: 0.9rem;
  color: rgba(58, 26, 10, 0.6);
  line-height: 1.5;
  margin: 0;
}

/* ── Transition ── */
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
