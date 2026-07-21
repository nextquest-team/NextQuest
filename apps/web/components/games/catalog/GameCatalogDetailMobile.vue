<script setup lang="ts">
const { t } = useI18n()

const { game, loading } = useGameCatalogDetail()

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
}

function ratingStars(rating: number | null): string {
  if (rating === null) return ''
  const r = Math.round(rating / 2)
  return '★'.repeat(Math.min(r, 5)) + '☆'.repeat(Math.max(0, 5 - r))
}
</script>

<template>
  <div class="cdm">

    <!-- ── Header fixe ── -->
    <div class="cdm__head">
      <UiPageHeader />
    </div>

    <!-- ── Zone scrollable ── -->
    <div class="cdm__body">

      <div v-if="loading" class="cdm__not-found">
        <v-progress-circular :aria-label="t('common.loading')" indeterminate size="32" color="primary" />
      </div>

      <div v-else-if="!game" class="cdm__not-found">
        <v-icon size="52" color="primary-light">mdi-help-circle-outline</v-icon>
        <h1 class="cdm__nf-title">{{ t('gameDetail.notFound') }}</h1>
        <p class="cdm__nf-hint">{{ t('gameDetail.notFoundHint') }}</p>
      </div>

      <template v-else-if="game">
        <!-- Cover pleine largeur -->
        <div class="cdm__cover">
          <img v-if="game.coverUrl" :src="game.coverUrl" :alt="game.title" class="cdm__cover-img" />
          <div v-else class="cdm__cover-ph">
            <v-icon size="48" color="primary-light">mdi-gamepad-variant</v-icon>
          </div>
        </div>

        <div class="cdm__hero-info">
          <h1 class="cdm__title">{{ game.title }}</h1>

          <!-- Note IGDB -->
          <div v-if="game.igdbRating !== null" class="cdm__rating">
            <span class="cdm__rating-stars">{{ ratingStars(game.igdbRating) }}</span>
            <span class="cdm__rating-num">{{ (game.igdbRating / 10).toFixed(1) }}/10</span>
          </div>

          <!-- Date + genres -->
          <dl v-if="game.releaseDate || game.genres.length" class="cdm__meta">
            <template v-if="game.releaseDate">
              <dt class="cdm__dt">{{ t('gameDetail.releaseDate') }}</dt>
              <dd class="cdm__dd">{{ formatDate(game.releaseDate) }}</dd>
            </template>
            <template v-if="game.genres.length">
              <dt class="cdm__dt">{{ t('gameDetail.genres') }}</dt>
              <dd class="cdm__dd">
                <span v-for="g in game.genres" :key="g.id" class="cdm__chip">{{ g.name }}</span>
              </dd>
            </template>
          </dl>
        </div>
      </template>

    </div>
  </div>
</template>

<style scoped>
.cdm {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 64px);
  overflow: hidden;
  font-family: var(--nq-font);
}

.cdm__head { flex-shrink: 0; padding: 0 1rem; }

.cdm__body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 1rem 1.5rem;
}

.cdm__not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  text-align: center;
}

.cdm__nf-title { font-size: 1rem; font-weight: bold; color: var(--nq-brown-dark, #3A1A0A); margin: 0; }
.cdm__nf-hint  { font-size: 0.85rem; color: rgba(var(--nq-brown-dark-rgb), 0.6); margin: 0; }

/* Cover pleine largeur */
.cdm__cover {
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

.cdm__cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cdm__cover-ph  { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }

.cdm__hero-info { padding-bottom: 1rem; }

.cdm__title { font-size: clamp(1.2rem, 5vw, 1.5rem); font-weight: bold; color: var(--nq-brown-dark, #3A1A0A); margin: 0 0 0.5rem; line-height: 1.25; }

.cdm__rating { display: flex; align-items: center; gap: 6px; margin-bottom: 0.85rem; }
.cdm__rating-stars { color: var(--nq-gold-dark); font-size: 0.85rem; }
.cdm__rating-num { font-weight: 700; font-size: 0.9rem; color: var(--nq-brown-dark); }

.cdm__meta { display: grid; grid-template-columns: auto 1fr; gap: 7px 14px; margin: 0; }

.cdm__dt {
  font-size: 0.72rem;
  font-weight: 700;
  color: rgba(var(--nq-brown-dark-rgb), 0.5);
  white-space: nowrap;
  align-self: start;
  padding-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cdm__dd { font-size: 0.82rem; color: var(--nq-brown-dark); margin: 0; display: flex; flex-wrap: wrap; gap: 4px; }

.cdm__chip {
  display: inline-block;
  background: rgba(var(--nq-brown-rgb), 0.08);
  color: var(--nq-brown, #5C3317);
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 0.72rem;
  font-weight: 600;
}
</style>
