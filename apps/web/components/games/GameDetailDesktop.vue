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

const lightboxIndex = ref<number | null>(null)
</script>

<template>
  <div class="gdd">
    <UiPageHeader />

    <!-- Chargement -->
    <div v-if="loading" class="gdd__not-found">
      <v-progress-circular :aria-label="t('common.loading')" indeterminate size="40" color="primary" />
    </div>

    <!-- Jeu introuvable -->
    <div v-else-if="!game" class="gdd__not-found">
      <v-icon size="56" color="primary-light">mdi-help-circle-outline</v-icon>
      <h1 class="gdd__nf-title">{{ t('gameDetail.notFound') }}</h1>
      <p class="gdd__nf-hint">{{ t('gameDetail.notFoundHint') }}</p>
    </div>

    <template v-else>
      <!-- Hero : cover + titre + statut -->
      <div class="gdd__hero">
        <div class="gdd__cover">
          <img v-if="game.game.coverUrl" :src="game.game.coverUrl" :alt="game.game.title" class="gdd__cover-img" />
          <div v-else class="gdd__cover-placeholder">
            <v-icon size="56" color="primary-light">mdi-gamepad-variant</v-icon>
          </div>
        </div>

        <div class="gdd__hero-info">
          <h1 class="gdd__title">{{ game.game.title }}</h1>

          <p class="gdd__label">{{ t('gameDetail.status') }}</p>
          <div class="gdd__statuses">
            <button
              v-for="s in GAME_STATUSES"
              :key="s.key"
              class="gdd__status-btn"
              :class="{ 'gdd__status-btn--active': game.status === s.key }"
              :aria-pressed="game.status === s.key"
              :title="t(`gameList.status.${s.key}`)"
              @click="onStatusChange(s.key)"
            >
              <v-icon size="15">{{ s.icon }}</v-icon>
              {{ t(`gameList.status.${s.key}`) }}
            </button>
          </div>

          <p class="gdd__label">{{ t('gameDetail.playtime') }}</p>
          <p class="gdd__value">
            {{ formatPlaytime(game.playtimeMinutes) ?? t('gameDetail.playtimeNone') }}
          </p>
        </div>
      </div>

      <!-- Bannière pas encore enrichi -->
      <div v-if="!game.game.isEnriched" class="gdd__coming-soon">
        <v-icon size="18" color="primary-light">mdi-information-outline</v-icon>
        {{ t('gameDetail.comingSoon') }}
      </div>

      <template v-else>
        <section v-if="igdb?.summary || game.description" class="gdd__section">
          <h2 class="gdd__section-title">{{ t('gameDetail.summary') }}</h2>
          <p class="gdd__summary nq-felt-panel">{{ igdb?.summary ?? game.description }}</p>
        </section>

        <section v-if="igdb?.storyline && igdb.storyline !== igdb.summary" class="gdd__section">
          <h2 class="gdd__section-title">{{ t('gameDetail.storyline') }}</h2>
          <p class="gdd__summary nq-felt-panel">{{ igdb.storyline }}</p>
        </section>

        <section v-if="igdb?.screenshots.length" class="gdd__section">
          <h2 class="gdd__section-title">{{ t('gameDetail.screenshots') }}</h2>
          <div class="gdd__screenshots">
            <img
              v-for="(url, i) in igdb.screenshots.slice(0, 6)"
              :key="i"
              :src="url"
              :alt="`${game.game.title} screenshot ${i + 1}`"
              class="gdd__screenshot"
              role="button"
              tabindex="0"
              :aria-label="t('gameDetail.screenshotOpen')"
              @click="lightboxIndex = i"
              @keydown.enter="lightboxIndex = i"
              @keydown.space.prevent="lightboxIndex = i"
            />
          </div>
        </section>

        <section class="gdd__section">
          <dl class="gdd__meta nq-felt-panel">
            <template v-if="game.game.releaseDate">
              <dt class="gdd__dt">{{ t('gameDetail.releaseDate') }}</dt>
              <dd class="gdd__dd">{{ formatReleaseDate(game.game.releaseDate) }}</dd>
            </template>
            <template v-if="game.game.developer">
              <dt class="gdd__dt">{{ t('gameDetail.developer') }}</dt>
              <dd class="gdd__dd">{{ game.game.developer }}</dd>
            </template>
            <template v-if="game.game.publisher && game.game.publisher !== game.game.developer">
              <dt class="gdd__dt">{{ t('gameDetail.publisher') }}</dt>
              <dd class="gdd__dd">{{ game.game.publisher }}</dd>
            </template>
            <template v-if="game.genres.length">
              <dt class="gdd__dt">{{ t('gameDetail.genres') }}</dt>
              <dd class="gdd__dd">
                <span v-for="g in game.genres" :key="g.id" class="gdd__chip">{{ g.name }}</span>
              </dd>
            </template>
            <template v-if="game.tags.length">
              <dt class="gdd__dt">{{ t('gameDetail.tags') }}</dt>
              <dd class="gdd__dd">
                <span v-for="tag in game.tags" :key="tag.id" class="gdd__chip gdd__chip--tag">{{ tag.name }}</span>
              </dd>
            </template>
            <template v-if="igdb?.platforms.length">
              <dt class="gdd__dt">{{ t('gameDetail.platforms') }}</dt>
              <dd class="gdd__dd">
                <span v-for="p in igdb.platforms" :key="p.igdbId" class="gdd__chip gdd__chip--platform">
                  {{ p.abbreviation ?? p.name }}
                </span>
              </dd>
            </template>
            <template v-if="igdb?.gameModes.length">
              <dt class="gdd__dt">{{ t('gameDetail.gameModes') }}</dt>
              <dd class="gdd__dd">
                <span v-for="m in igdb.gameModes" :key="m.igdbId" class="gdd__chip gdd__chip--tag">{{ m.name }}</span>
              </dd>
            </template>
            <template v-if="game.game.igdbRating !== null">
              <dt class="gdd__dt">{{ t('gameDetail.igdbRating') }}</dt>
              <dd class="gdd__dd">
                <span class="gdd__rating">
                  <v-icon size="16" color="gold">mdi-star</v-icon>
                  {{ (game.game.igdbRating / 10).toFixed(1) }}<span class="gdd__rating-max">/10</span>
                </span>
              </dd>
            </template>
          </dl>
        </section>

        <section v-if="igdb?.similarGames.length || game.similarGames.length" class="gdd__section">
          <h2 class="gdd__section-title">{{ t('gameDetail.similarGames') }}</h2>
          <div class="gdd__similar">
            <template v-if="igdb?.similarGames.length">
              <NuxtLink
                v-for="sim in igdb.similarGames"
                :key="sim.igdbId"
                :to="`/games/catalog/${sim.igdbId}`"
                class="gdd__similar-item"
              >
                <div class="gdd__similar-cover">
                  <img v-if="sim.coverUrl" :src="sim.coverUrl" :alt="sim.title" />
                  <v-icon v-else size="24" color="primary-light">mdi-gamepad-variant</v-icon>
                </div>
                <div class="gdd__similar-title nq-felt-panel">
                  <span class="gdd__similar-title-text">{{ sim.title }}</span>
                </div>
              </NuxtLink>
            </template>
            <template v-else>
              <component
                :is="sim.igdbId ? 'NuxtLink' : 'div'"
                v-for="sim in game.similarGames"
                :key="sim.id"
                :to="sim.igdbId ? `/games/catalog/${sim.igdbId}` : undefined"
                class="gdd__similar-item"
              >
                <div class="gdd__similar-cover">
                  <img v-if="sim.coverUrl" :src="sim.coverUrl" :alt="sim.title" />
                  <v-icon v-else size="24" color="primary-light">mdi-gamepad-variant</v-icon>
                </div>
                <div class="gdd__similar-title nq-felt-panel">
                  <span class="gdd__similar-title-text">{{ sim.title }}</span>
                </div>
              </component>
            </template>
          </div>
        </section>
      </template>

      <!-- Retirer de la liste -->
      <div class="gdd__danger">
        <p v-if="removeError" class="gdd__remove-error">{{ removeError }}</p>
        <button class="gdd__remove-btn" @click="showRemoveConfirm = true">
          <v-icon size="16">mdi-trash-can-outline</v-icon>
          {{ t('gameDetail.removeGame') }}
        </button>
      </div>

      <!-- Confirmation suppression -->
      <Transition name="modal">
        <div v-if="showRemoveConfirm" class="gdd__confirm-backdrop" role="dialog" aria-modal="true" @click.self="showRemoveConfirm = false">
          <div class="gdd__confirm-box">
            <p class="gdd__confirm-text">{{ t('gameDetail.removeConfirm') }}</p>
            <div class="gdd__confirm-actions">
              <button class="gdd__confirm-btn gdd__confirm-btn--cancel" @click="showRemoveConfirm = false">
                {{ t('profil.cancel') }}
              </button>
              <button class="gdd__confirm-btn gdd__confirm-btn--delete" @click="confirmRemove">
                {{ t('gameDetail.removeGame') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </template>

    <UiScreenshotModal
      v-if="igdb"
      :screenshots="igdb.screenshots"
      :index="lightboxIndex"
      :alt="game?.game.title ?? ''"
      @update:index="lightboxIndex = $event"
    />
  </div>
</template>

<style scoped>
.gdd {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 1.25rem 1rem 3rem;
  font-family: var(--nq-font);
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}

.gdd__not-found {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  text-align: center;
  padding: 3rem 1rem;
}

.gdd__nf-title { font-size: clamp(1.15rem, 2.6vw, 1.3rem); font-weight: bold; color: var(--nq-brown-dark, #3A1A0A); margin: 0; }
.gdd__nf-hint  { font-size: clamp(0.95rem, 2.2vw, 1.08rem); color: rgba(var(--nq-brown-dark-rgb), 0.65); margin: 0; }

.gdd__hero { display: flex; gap: 1.25rem; align-items: flex-start; margin-bottom: 1.75rem; }

.gdd__cover {
  flex-shrink: 0;
  width: 140px;
  min-height: 190px;
  background: rgba(var(--nq-brown-rgb), 0.08);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gdd__cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }

.gdd__cover-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 190px; }

.gdd__hero-info { flex: 1; min-width: 0; }

.gdd__title { font-size: clamp(1.2rem, 3.5vw, 1.6rem); font-weight: bold; color: var(--nq-brown-dark, #3A1A0A); margin: 0 0 1rem; line-height: 1.25; }

.gdd__label { font-size: clamp(0.76rem, 1.7vw, 0.9rem); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(var(--nq-brown-dark-rgb), 0.75); margin: 0 0 6px; }
.gdd__value { font-size: clamp(0.95rem, 2.2vw, 1.08rem); color: var(--nq-brown-dark, #3A1A0A); margin: 0 0 1rem; }

.gdd__statuses { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 1rem; }

.gdd__status-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid rgba(var(--nq-brown-rgb), 0.25);
  background: transparent;
  color: rgba(var(--nq-brown-dark-rgb), 0.72);
  font-family: var(--nq-font);
  font-size: 0.75rem;
  cursor: pointer;
  white-space: nowrap;
  min-height: 30px;
  transition: background 0.1s, color 0.1s;
}

.gdd__status-btn:hover:not(.gdd__status-btn--active) { background: rgba(var(--nq-brown-rgb), 0.08); color: var(--nq-brown-dark); }
.gdd__status-btn--active { background: var(--nq-brown, #5C3317); color: #edc78e; border-color: var(--nq-brown); }

.gdd__coming-soon {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(var(--nq-gold-rgb), 0.1);
  border: 1px solid rgba(var(--nq-gold-rgb), 0.3);
  border-radius: 10px;
  padding: 12px 16px;
  font-size: clamp(0.9rem, 2.1vw, 1.02rem);
  color: rgba(var(--nq-brown-dark-rgb), 0.7);
  margin-bottom: 1.5rem;
}

.gdd__section { margin-bottom: 1.75rem; }

.gdd__section-title {
  font-size: clamp(0.85rem, 2vw, 0.98rem);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(var(--nq-brown-dark-rgb), 0.75);
  margin: 0 0 0.6rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid rgba(var(--nq-brown-rgb), 0.1);
}

.gdd__summary { font-size: clamp(0.95rem, 2.2vw, 1.08rem); line-height: 1.65; color: rgba(var(--nq-brown-dark-rgb), 0.85); margin: 0; }

.gdd__meta { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; margin: 0; }

.gdd__dt { font-size: clamp(0.8rem, 1.8vw, 0.92rem); font-weight: 700; color: rgba(var(--nq-brown-dark-rgb), 0.75); white-space: nowrap; align-self: start; padding-top: 2px; }
.gdd__dd { font-size: clamp(0.92rem, 2.1vw, 1.05rem); color: var(--nq-brown-dark, #3A1A0A); margin: 0; display: flex; flex-wrap: wrap; gap: 4px; }

.gdd__chip { display: inline-block; background: rgba(var(--nq-brown-rgb), 0.08); color: var(--nq-brown, #5C3317); border-radius: 999px; padding: 2px 10px; font-size: clamp(0.82rem, 1.9vw, 0.95rem); font-weight: 600; }
.gdd__chip--tag      { background: rgba(var(--nq-brown-rgb), 0.04); font-weight: 400; color: rgba(var(--nq-brown-dark-rgb), 0.72); }
.gdd__chip--platform { background: rgba(26, 47, 72, 0.07); color: var(--nq-navy); font-weight: 500; }

.gdd__screenshots { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px; }
.gdd__screenshots::-webkit-scrollbar { display: none; }

.gdd__screenshot { flex-shrink: 0; width: 220px; height: 124px; border-radius: 8px; object-fit: cover; background: rgba(var(--nq-brown-rgb), 0.08); cursor: pointer; }
.gdd__screenshot:hover { filter: brightness(0.92); }

.gdd__similar { display: flex; gap: 12px; flex-wrap: wrap; align-items: stretch; }

.gdd__similar-item { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 80px; text-decoration: none; }

.gdd__similar-cover { width: 80px; height: 106px; flex-shrink: 0; border-radius: 8px; background: rgba(var(--nq-brown-rgb), 0.08); overflow: hidden; display: flex; align-items: center; justify-content: center; }
.gdd__similar-cover img { width: 100%; height: 100%; object-fit: cover; }

.gdd__similar-title {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  background-size: auto, 90px 90px;
  padding: 4px 6px;
}
.gdd__similar-title-text {
  font-size: clamp(0.75rem, 1.7vw, 0.88rem);
  color: rgba(var(--nq-brown-dark-rgb), 0.7);
  text-align: center;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.gdd__rating { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; font-size: clamp(1rem, 2.3vw, 1.12rem); color: var(--nq-brown-dark); }
.gdd__rating-max { font-size: clamp(0.8rem, 1.9vw, 0.92rem); font-weight: 400; color: rgba(var(--nq-brown-dark-rgb), 0.65); }

.gdd__danger { margin-top: auto; padding-top: 2rem; display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; }

.gdd__remove-error { font-size: clamp(0.87rem, 2vw, 1rem); color: var(--nq-red); margin: 0; }

.gdd__remove-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid rgba(var(--nq-red-rgb), 0.3);
  border-radius: 8px;
  padding: 8px 14px;
  font-family: var(--nq-font);
  font-size: 0.82rem;
  font-weight: 600;
  color: rgba(var(--nq-red-rgb), 0.65);
  cursor: pointer;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.gdd__remove-btn:hover { background: rgba(var(--nq-red-rgb), 0.06); color: var(--nq-red); border-color: rgba(var(--nq-red-rgb), 0.5); }

.gdd__confirm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(var(--nq-scrim-rgb), 0.55);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.gdd__confirm-box { background: var(--nq-cream, #F8F4EA); border-radius: 14px; padding: 1.5rem; max-width: 340px; width: 100%; box-shadow: 0 8px 32px rgba(var(--nq-brown-dark-rgb), 0.2); }
.gdd__confirm-text { font-size: clamp(1rem, 2.3vw, 1.12rem); color: var(--nq-brown-dark); margin: 0 0 1.25rem; text-align: center; }
.gdd__confirm-actions { display: flex; gap: 0.75rem; justify-content: center; }

.gdd__confirm-btn { flex: 1; padding: 9px 16px; border-radius: 8px; font-family: var(--nq-font); font-size: 0.85rem; font-weight: 600; border: none; cursor: pointer; transition: background 0.15s; }
.gdd__confirm-btn--cancel { background: rgba(var(--nq-brown-rgb), 0.1); color: var(--nq-brown); }
.gdd__confirm-btn--cancel:hover { background: rgba(var(--nq-brown-rgb), 0.18); }
.gdd__confirm-btn--delete { background: var(--nq-red); color: #fff; }
.gdd__confirm-btn--delete:hover { background: var(--nq-red-dark); }

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
