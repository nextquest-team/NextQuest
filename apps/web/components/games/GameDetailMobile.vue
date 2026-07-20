<script setup lang="ts">
import { GAME_STATUSES } from '~/composables/useGameDetail'

const { t } = useI18n()

const {
  game, igdb, loading,
  showRemoveConfirm, removeError,
  load, formatPlaytime, formatReleaseDate,
  onStatusChange, confirmRemove,
} = useGameDetail()

onMounted(load)
</script>

<template>
  <div class="gdm">

    <!-- ── Header fixe ── -->
    <div class="gdm__head">
      <UiPageHeader />
    </div>

    <!-- ── Zone scrollable ── -->
    <div class="gdm__body">

      <!-- Chargement -->
      <div v-if="loading" class="gdm__state">
        <v-progress-circular indeterminate size="36" color="primary" />
      </div>

      <!-- Jeu introuvable -->
      <div v-else-if="!game" class="gdm__state">
        <v-icon size="52" color="primary-light">mdi-help-circle-outline</v-icon>
        <p class="gdm__nf-title">{{ t('gameDetail.notFound') }}</p>
        <p class="gdm__nf-hint">{{ t('gameDetail.notFoundHint') }}</p>
      </div>

      <template v-else>

        <!-- Hero : cover full-width + info -->
        <div class="gdm__cover">
          <img v-if="game.game.coverUrl" :src="game.game.coverUrl" :alt="game.game.title" class="gdm__cover-img" />
          <div v-else class="gdm__cover-ph">
            <v-icon size="48" color="primary-light">mdi-gamepad-variant</v-icon>
          </div>
        </div>

        <div class="gdm__hero-info">
          <h1 class="gdm__title">{{ game.game.title }}</h1>

          <!-- Statut -->
          <p class="gdm__label">{{ t('gameDetail.status') }}</p>
          <div class="gdm__statuses">
            <button
              v-for="s in GAME_STATUSES"
              :key="s.key"
              class="gdm__status-btn"
              :class="{ 'gdm__status-btn--active': game.status === s.key }"
              :aria-pressed="game.status === s.key"
              :title="t(`gameList.status.${s.key}`)"
              @click="onStatusChange(s.key)"
            >
              <v-icon size="14">{{ s.icon }}</v-icon>
              {{ t(`gameList.status.${s.key}`) }}
            </button>
          </div>

          <!-- Temps de jeu -->
          <p class="gdm__label">{{ t('gameDetail.playtime') }}</p>
          <p class="gdm__value">{{ formatPlaytime(game.playtimeMinutes) ?? t('gameDetail.playtimeNone') }}</p>
        </div>

        <!-- Bannière pas encore enrichi -->
        <div v-if="!game.game.isEnriched" class="gdm__coming-soon">
          <v-icon size="16" color="primary-light">mdi-information-outline</v-icon>
          {{ t('gameDetail.comingSoon') }}
        </div>

        <template v-else>

          <!-- Synopsis -->
          <section v-if="igdb?.summary || game.description" class="gdm__section">
            <h2 class="gdm__section-title">{{ t('gameDetail.summary') }}</h2>
            <p class="gdm__summary">{{ igdb?.summary ?? game.description }}</p>
          </section>

          <!-- Storyline -->
          <section v-if="igdb?.storyline && igdb.storyline !== igdb.summary" class="gdm__section">
            <h2 class="gdm__section-title">{{ t('gameDetail.storyline') }}</h2>
            <p class="gdm__summary">{{ igdb.storyline }}</p>
          </section>

          <!-- Screenshots -->
          <section v-if="igdb?.screenshots.length" class="gdm__section">
            <h2 class="gdm__section-title">{{ t('gameDetail.screenshots') }}</h2>
            <div class="gdm__screenshots">
              <img
                v-for="(url, i) in igdb.screenshots.slice(0, 6)"
                :key="i"
                :src="url"
                :alt="`${game.game.title} screenshot ${i + 1}`"
                class="gdm__screenshot"
              />
            </div>
          </section>

          <!-- Infos meta -->
          <section class="gdm__section">
            <dl class="gdm__meta">
              <template v-if="game.game.releaseDate">
                <dt class="gdm__dt">{{ t('gameDetail.releaseDate') }}</dt>
                <dd class="gdm__dd">{{ formatReleaseDate(game.game.releaseDate) }}</dd>
              </template>
              <template v-if="game.game.developer">
                <dt class="gdm__dt">{{ t('gameDetail.developer') }}</dt>
                <dd class="gdm__dd">{{ game.game.developer }}</dd>
              </template>
              <template v-if="game.game.publisher && game.game.publisher !== game.game.developer">
                <dt class="gdm__dt">{{ t('gameDetail.publisher') }}</dt>
                <dd class="gdm__dd">{{ game.game.publisher }}</dd>
              </template>
              <template v-if="game.genres.length">
                <dt class="gdm__dt">{{ t('gameDetail.genres') }}</dt>
                <dd class="gdm__dd">
                  <span v-for="g in game.genres" :key="g.id" class="gdm__chip">{{ g.name }}</span>
                </dd>
              </template>
              <template v-if="game.tags.length">
                <dt class="gdm__dt">{{ t('gameDetail.tags') }}</dt>
                <dd class="gdm__dd">
                  <span v-for="tag in game.tags" :key="tag.id" class="gdm__chip gdm__chip--tag">{{ tag.name }}</span>
                </dd>
              </template>
              <template v-if="igdb?.platforms.length">
                <dt class="gdm__dt">{{ t('gameDetail.platforms') }}</dt>
                <dd class="gdm__dd">
                  <span v-for="p in igdb.platforms" :key="p.igdbId" class="gdm__chip gdm__chip--platform">
                    {{ p.abbreviation ?? p.name }}
                  </span>
                </dd>
              </template>
              <template v-if="igdb?.gameModes.length">
                <dt class="gdm__dt">{{ t('gameDetail.gameModes') }}</dt>
                <dd class="gdm__dd">
                  <span v-for="m in igdb.gameModes" :key="m.igdbId" class="gdm__chip gdm__chip--tag">{{ m.name }}</span>
                </dd>
              </template>
              <template v-if="game.game.igdbRating !== null">
                <dt class="gdm__dt">{{ t('gameDetail.igdbRating') }}</dt>
                <dd class="gdm__dd">
                  <span class="gdm__rating">
                    <v-icon size="14" color="gold">mdi-star</v-icon>
                    {{ (game.game.igdbRating / 10).toFixed(1) }}<span class="gdm__rating-max">/10</span>
                  </span>
                </dd>
              </template>
            </dl>
          </section>

          <!-- Jeux similaires -->
          <section v-if="igdb?.similarGames.length || game.similarGames.length" class="gdm__section">
            <h2 class="gdm__section-title">{{ t('gameDetail.similarGames') }}</h2>
            <div class="gdm__similar">
              <template v-if="igdb?.similarGames.length">
                <div v-for="sim in igdb.similarGames" :key="sim.igdbId" class="gdm__similar-item">
                  <div class="gdm__similar-cover">
                    <img v-if="sim.coverUrl" :src="sim.coverUrl" :alt="sim.title" />
                    <v-icon v-else size="20" color="primary-light">mdi-gamepad-variant</v-icon>
                  </div>
                  <span class="gdm__similar-title">{{ sim.title }}</span>
                </div>
              </template>
              <template v-else>
                <div v-for="sim in game.similarGames" :key="sim.id" class="gdm__similar-item">
                  <div class="gdm__similar-cover">
                    <img v-if="sim.coverUrl" :src="sim.coverUrl" :alt="sim.title" />
                    <v-icon v-else size="20" color="primary-light">mdi-gamepad-variant</v-icon>
                  </div>
                  <span class="gdm__similar-title">{{ sim.title }}</span>
                </div>
              </template>
            </div>
          </section>

        </template>

        <!-- Retirer de la liste -->
        <div class="gdm__danger">
          <p v-if="removeError" class="gdm__remove-error">{{ removeError }}</p>
          <button class="gdm__remove-btn" @click="showRemoveConfirm = true">
            <v-icon size="15">mdi-trash-can-outline</v-icon>
            {{ t('gameDetail.removeGame') }}
          </button>
        </div>

      </template>
    </div>

    <!-- Modale confirmation suppression -->
    <Transition name="modal">
      <div v-if="showRemoveConfirm" class="gdm__confirm-backdrop" role="dialog" aria-modal="true" @click.self="showRemoveConfirm = false">
        <div class="gdm__confirm-box">
          <p class="gdm__confirm-text">{{ t('gameDetail.removeConfirm') }}</p>
          <div class="gdm__confirm-actions">
            <button class="gdm__confirm-btn gdm__confirm-btn--cancel" @click="showRemoveConfirm = false">
              {{ t('profil.cancel') }}
            </button>
            <button class="gdm__confirm-btn gdm__confirm-btn--delete" @click="confirmRemove">
              {{ t('gameDetail.removeGame') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
/* ── Conteneur mobile ── */
.gdm {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 64px);
  overflow: hidden;
  font-family: var(--nq-font);
}

.gdm__head {
  flex-shrink: 0;
  padding: 0 1rem;
}

.gdm__body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 1rem 1.5rem;
}

/* ── États ── */
.gdm__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  text-align: center;
}

.gdm__nf-title { font-size: 1rem; font-weight: bold; color: var(--nq-brown-dark, #3A1A0A); margin: 0; }
.gdm__nf-hint  { font-size: 0.85rem; color: rgba(var(--nq-brown-dark-rgb), 0.6); margin: 0; }

/* ── Hero mobile : cover pleine largeur ── */
.gdm__cover {
  width: calc(100% + 2rem);
  margin-left: -1rem;
  margin-right: -1rem;
  height: 220px;
  background: rgba(var(--nq-brown-rgb), 0.08);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.gdm__cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gdm__cover-ph  { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }

.gdm__hero-info { margin-bottom: 1.25rem; }

.gdm__title {
  font-size: clamp(1.2rem, 5vw, 1.5rem);
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0 0 0.75rem;
  line-height: 1.25;
}

.gdm__label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(var(--nq-brown-dark-rgb), 0.75);
  margin: 0 0 5px;
}

.gdm__value { font-size: 0.85rem; color: var(--nq-brown-dark, #3A1A0A); margin: 0 0 0.85rem; }

.gdm__statuses { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 0.85rem; }

.gdm__status-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid rgba(var(--nq-brown-rgb), 0.25);
  background: transparent;
  color: rgba(var(--nq-brown-dark-rgb), 0.6);
  font-family: var(--nq-font);
  font-size: 0.72rem;
  cursor: pointer;
  white-space: nowrap;
  min-height: 28px;
  transition: background 0.1s, color 0.1s;
}

.gdm__status-btn:hover:not(.gdm__status-btn--active) { background: rgba(var(--nq-brown-rgb), 0.08); color: var(--nq-brown-dark); }
.gdm__status-btn--active { background: var(--nq-brown, #5C3317); color: #edc78e; border-color: var(--nq-brown); }

/* ── Coming soon ── */
.gdm__coming-soon {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(var(--nq-gold-rgb), 0.1);
  border: 1px solid rgba(var(--nq-gold-rgb), 0.3);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.82rem;
  color: rgba(var(--nq-brown-dark-rgb), 0.7);
  margin-bottom: 1.25rem;
}

/* ── Sections ── */
.gdm__section { margin-bottom: 1.5rem; }

.gdm__section-title {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(var(--nq-brown-dark-rgb), 0.75);
  margin: 0 0 0.5rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid rgba(var(--nq-brown-rgb), 0.1);
}

.gdm__summary { font-size: 0.875rem; line-height: 1.65; color: rgba(var(--nq-brown-dark-rgb), 0.85); margin: 0; }

/* ── Meta ── */
.gdm__meta { display: grid; grid-template-columns: auto 1fr; gap: 7px 14px; margin: 0; }

.gdm__dt {
  font-size: 0.72rem;
  font-weight: 700;
  color: rgba(var(--nq-brown-dark-rgb), 0.75);
  white-space: nowrap;
  align-self: start;
  padding-top: 2px;
}

.gdm__dd { font-size: 0.82rem; color: var(--nq-brown-dark, #3A1A0A); margin: 0; display: flex; flex-wrap: wrap; gap: 4px; }

/* ── Chips ── */
.gdm__chip {
  display: inline-block;
  background: rgba(var(--nq-brown-rgb), 0.08);
  color: var(--nq-brown, #5C3317);
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 0.72rem;
  font-weight: 600;
}

.gdm__chip--tag     { background: rgba(var(--nq-brown-rgb), 0.04); font-weight: 400; color: rgba(var(--nq-brown-dark-rgb), 0.6); }
.gdm__chip--platform { background: rgba(26, 47, 72, 0.07); color: var(--nq-navy); font-weight: 500; }

/* ── Screenshots ── */
.gdm__screenshots {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 4px;
  /* Extend to edges on mobile */
  margin-left: -1rem;
  margin-right: -1rem;
  padding-left: 1rem;
  padding-right: 1rem;
}

.gdm__screenshots::-webkit-scrollbar { display: none; }

.gdm__screenshot {
  flex-shrink: 0;
  width: 200px;
  height: 113px;
  border-radius: 8px;
  object-fit: cover;
  background: rgba(var(--nq-brown-rgb), 0.08);
}

/* ── Similaires ── */
.gdm__similar { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px; }
.gdm__similar::-webkit-scrollbar { display: none; }

.gdm__similar-item { display: flex; flex-direction: column; align-items: center; gap: 5px; width: 70px; flex-shrink: 0; }

.gdm__similar-cover {
  width: 70px;
  height: 93px;
  border-radius: 7px;
  background: rgba(var(--nq-brown-rgb), 0.08);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gdm__similar-cover img { width: 100%; height: 100%; object-fit: cover; }

.gdm__similar-title {
  font-size: 0.65rem;
  color: rgba(var(--nq-brown-dark-rgb), 0.7);
  text-align: center;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Note ── */
.gdm__rating { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; font-size: 0.9rem; color: var(--nq-brown-dark); }
.gdm__rating-max { font-size: 0.7rem; font-weight: 400; color: rgba(var(--nq-brown-dark-rgb), 0.65); }

/* ── Danger zone ── */
.gdm__danger { padding: 1.5rem 0 0.5rem; display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem; }

.gdm__remove-error { font-size: 0.78rem; color: var(--nq-red); margin: 0; }

.gdm__remove-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: 1px solid rgba(var(--nq-red-rgb), 0.3);
  border-radius: 8px;
  padding: 7px 12px;
  font-family: var(--nq-font);
  font-size: 0.78rem;
  font-weight: 600;
  color: rgba(var(--nq-red-rgb), 0.65);
  cursor: pointer;
  min-height: 36px;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.gdm__remove-btn:hover { background: rgba(var(--nq-red-rgb), 0.06); color: var(--nq-red); border-color: rgba(var(--nq-red-rgb), 0.5); }

/* ── Confirm modal ── */
.gdm__confirm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(var(--nq-scrim-rgb), 0.55);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.gdm__confirm-box {
  background: var(--nq-cream, #F8F4EA);
  border-radius: 14px;
  padding: 1.5rem;
  max-width: 320px;
  width: 100%;
  box-shadow: 0 8px 32px rgba(var(--nq-brown-dark-rgb), 0.2);
}

.gdm__confirm-text { font-size: 0.9rem; color: var(--nq-brown-dark); margin: 0 0 1.25rem; text-align: center; }

.gdm__confirm-actions { display: flex; gap: 0.75rem; justify-content: center; }

.gdm__confirm-btn {
  flex: 1;
  padding: 9px 14px;
  border-radius: 8px;
  font-family: var(--nq-font);
  font-size: 0.85rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}

.gdm__confirm-btn--cancel { background: rgba(var(--nq-brown-rgb), 0.1); color: var(--nq-brown); }
.gdm__confirm-btn--cancel:hover { background: rgba(var(--nq-brown-rgb), 0.18); }
.gdm__confirm-btn--delete { background: var(--nq-red); color: #fff; }
.gdm__confirm-btn--delete:hover { background: var(--nq-red-dark); }

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
