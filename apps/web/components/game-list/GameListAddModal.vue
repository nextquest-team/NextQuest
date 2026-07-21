<script setup lang="ts">
import { ref, watch } from 'vue'
import type { IgdbSearchResult } from '~/types/game'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; added: [] }>()

const { t } = useI18n()
const { authFetch, apiBase } = useAuthFetch()
const { push } = useToast()

// Focus-trap + Echap (WCAG 2.4.3, 2.1.2) : voir useFocusTrap.ts
const modalBox = ref<HTMLElement | null>(null)
useFocusTrap(modalBox, () => props.open, () => emit('close'))

const MIN_QUERY = 2
const DEBOUNCE_MS = 300

const search = ref('')
const results = ref<IgdbSearchResult[]>([])
const loading = ref(false)
const searched = ref(false)
const pendingGame = ref<IgdbSearchResult | null>(null)
const adding = ref(false)

// Recherche robuste : debounce, annulation de la requete precedente
// (AbortController), garde de sequence (on ignore une reponse plus ancienne qui
// arriverait apres une plus recente), et longueur minimale pour ne pas taper
// IGDB sur 1 caractere. Le backend cache deja les resultats (Redis).
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let inFlight: AbortController | null = null
let querySeq = 0

watch(search, (q) => {
  const query = q.trim()
  if (debounceTimer) clearTimeout(debounceTimer)
  // Toute nouvelle frappe rend la requete en cours obsolete.
  if (inFlight) {
    inFlight.abort()
    inFlight = null
  }
  if (query.length < MIN_QUERY) {
    results.value = []
    searched.value = false
    loading.value = false
    return
  }
  loading.value = true
  debounceTimer = setTimeout(() => runSearch(query), DEBOUNCE_MS)
})

async function runSearch(query: string) {
  const seq = ++querySeq
  const controller = new AbortController()
  inFlight = controller
  try {
    const res = await authFetch<{ items: IgdbSearchResult[] }>(
      `${apiBase}/api/games/igdb/search`,
      { query: { q: query }, signal: controller.signal },
    )
    if (seq !== querySeq) return // une recherche plus recente a pris le relais
    results.value = res.items
    searched.value = true
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return // annulee, silencieux
    if (seq !== querySeq) return
    results.value = []
    searched.value = true
  } finally {
    if (seq === querySeq) loading.value = false
    if (inFlight === controller) inFlight = null
  }
}

function startAdd(game: IgdbSearchResult) {
  pendingGame.value = game
}

function cancelAdd() {
  pendingGame.value = null
}

function markAdded(igdbId: number) {
  const r = results.value.find((x) => x.igdbId === igdbId)
  if (r) r.alreadyInCollection = true
}

async function confirmAdd(platformId: string | null) {
  const game = pendingGame.value
  if (!game || adding.value) return
  adding.value = true
  try {
    await authFetch(`${apiBase}/api/collection/from-igdb`, {
      method: 'POST',
      body: { igdbId: game.igdbId, ...(platformId ? { platformId } : {}) },
    })
    push({ type: 'success', text: t('gameList.addModal.added', { title: game.name }) })
    markAdded(game.igdbId)
    emit('added')
    pendingGame.value = null
  } catch (err) {
    const status =
      (err as { status?: number; statusCode?: number })?.status ??
      (err as { statusCode?: number })?.statusCode
    if (status === 409) {
      push({ type: 'info', text: t('gameList.addModal.alreadyIn') })
      markAdded(game.igdbId)
      pendingGame.value = null
    } else {
      push({ type: 'error', text: t('gameList.addModal.addError') })
    }
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <Transition name="modal">
    <div
      v-if="open"
      class="gl-modal__backdrop"
      role="dialog"
      aria-modal="true"
      :aria-label="t('gameList.addModal.title')"
      @click.self="emit('close')"
    >
      <div ref="modalBox" class="gl-modal__box">
        <!-- En-tete -->
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

        <!-- Choix de plateforme : uniquement celles ou le jeu existe (IGDB) -->
        <div v-if="pendingGame" class="gl-add__platform">
          <button class="gl-add__back" @click="cancelAdd">
            <v-icon size="16">mdi-arrow-left</v-icon>
            {{ t('gameList.addModal.back') }}
          </button>
          <p class="gl-add__platform-title">
            {{ t('gameList.addModal.choosePlatform', { title: pendingGame.name }) }}
          </p>
          <div class="gl-add__platform-list">
            <button
              v-for="p in pendingGame.platforms"
              :key="p.id"
              class="gl-add__platform-btn"
              :disabled="adding"
              @click="confirmAdd(p.id)"
            >
              {{ p.name }}
            </button>
            <button
              class="gl-add__platform-btn gl-add__platform-btn--none"
              :disabled="adding"
              @click="confirmAdd(null)"
            >
              {{ t('gameList.addModal.noPlatform') }}
            </button>
          </div>
        </div>

        <!-- Resultats -->
        <div v-else class="gl-add__content">
          <div v-if="loading" class="gl-add__state">
            <v-progress-circular indeterminate size="28" color="#5c3317" />
          </div>

          <div v-else-if="searched && results.length === 0" class="gl-add__state">
            <v-icon size="40" color="#a07850">mdi-magnify-close</v-icon>
            <p class="gl-add__state-text">{{ t('gameList.addModal.empty') }}</p>
          </div>

          <div v-else-if="results.length" class="gl-add__results">
            <div v-for="game in results" :key="game.igdbId" class="gl-add__card">
              <div class="gl-add__cover">
                <img v-if="game.coverUrl" :src="game.coverUrl" :alt="game.name" class="gl-add__cover-img" />
                <div v-else class="gl-add__cover-ph">
                  <v-icon size="26" color="#a07850">mdi-gamepad-variant</v-icon>
                </div>
              </div>
              <div class="gl-add__meta">
                <p class="gl-add__name">{{ game.name }}</p>
                <p v-if="game.releaseYear" class="gl-add__year">{{ game.releaseYear }}</p>
              </div>
              <span v-if="game.alreadyInCollection" class="gl-add__badge">
                {{ t('gameList.addModal.alreadyBadge') }}
              </span>
              <button
                v-else
                class="gl-add__plus"
                :aria-label="t('gameList.addModal.add')"
                @click="startAdd(game)"
              >
                <v-icon size="20">mdi-plus</v-icon>
              </button>
            </div>
          </div>

          <div v-else class="gl-add__state">
            <v-icon size="40" color="#a07850">mdi-database-search-outline</v-icon>
            <p class="gl-add__state-text">{{ t('gameList.addModal.hint') }}</p>
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
  background: rgba(var(--nq-scrim-rgb), 0.55);
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
  box-shadow: 0 8px 32px rgba(var(--nq-brown-dark-rgb), 0.2);
}

/* ── En-tete ── */
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

/* ── Recherche ── */
.gl-modal__search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 1rem 1.25rem 0;
  background: rgba(var(--nq-brown-rgb), 0.07);
  border-radius: 8px;
  padding: 8px 12px;
  flex-shrink: 0;
}

.gl-modal__search-icon { color: var(--nq-brown, #5c3317); opacity: 0.6; }

.gl-modal__search {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-family: var(--nq-font);
  font-size: 0.9rem;
  color: var(--nq-brown-dark, #3a1a0a);
}
.gl-modal__search::placeholder { color: rgba(var(--nq-brown-dark-rgb), 0.4); }

/* ── Contenu / etats ── */
.gl-add__content {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1.25rem 1.25rem;
}

.gl-add__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem 1rem;
  text-align: center;
}

.gl-add__state-text {
  font-family: var(--nq-font);
  font-size: 0.9rem;
  color: rgba(var(--nq-brown-dark-rgb), 0.6);
  line-height: 1.5;
  margin: 0;
}

/* ── Resultats ── */
.gl-add__results { display: flex; flex-direction: column; gap: 8px; }

.gl-add__card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  border-radius: 8px;
  background: rgba(92, 51, 23, 0.05);
}

.gl-add__cover {
  width: 40px;
  height: 54px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(92, 51, 23, 0.08);
}
.gl-add__cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gl-add__cover-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }

.gl-add__meta { flex: 1; min-width: 0; }
.gl-add__name {
  font-family: var(--nq-font);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--nq-brown-dark, #3a1a0a);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gl-add__year { font-size: 0.8rem; color: rgba(58, 26, 10, 0.5); margin: 2px 0 0; }

.gl-add__badge {
  font-family: var(--nq-font);
  font-size: 0.72rem;
  color: #1a5c2a;
  background: #d4edda;
  padding: 3px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.gl-add__plus {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #edc78e;
  background: var(--nq-brown, #5c3317);
  transition: background 0.1s;
}
.gl-add__plus:hover { background: var(--nq-brown-dark, #3a1a0a); }

/* ── Choix de plateforme ── */
.gl-add__platform { padding: 0.75rem 1.25rem 1.25rem; overflow-y: auto; }

.gl-add__back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--nq-font);
  font-size: 0.82rem;
  color: var(--nq-brown, #5c3317);
  padding: 0;
  margin-bottom: 0.75rem;
}

.gl-add__platform-title {
  font-family: var(--nq-font);
  font-size: 0.92rem;
  color: var(--nq-brown-dark, #3a1a0a);
  margin: 0 0 0.75rem;
}

.gl-add__platform-list { display: flex; flex-wrap: wrap; gap: 8px; }

.gl-add__platform-btn {
  font-family: var(--nq-font);
  font-size: 0.85rem;
  padding: 8px 14px;
  border: 1px solid rgba(92, 51, 23, 0.2);
  border-radius: 999px;
  background: #fff;
  color: var(--nq-brown-dark, #3a1a0a);
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
}
.gl-add__platform-btn:hover:not(:disabled) { border-color: var(--nq-brown, #5c3317); background: #f3e9d8; }
.gl-add__platform-btn:disabled { opacity: 0.5; cursor: default; }
.gl-add__platform-btn--none { color: rgba(58, 26, 10, 0.55); }

/* ── Transition ── */
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
